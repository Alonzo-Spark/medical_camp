from .serializers import (
    MedicineSerializer, MedicalCampSerializer, PatientSerializer,
    PatientVitalsSerializer, VitalsSerializer, DoctorSerializer,
    MedicalTestSerializer, TestIssueSerializer, PatientMedicineIssueSerializer,
    CampWiseStockSerializer, ScanSessionSerializer
)
from django.shortcuts import render, redirect, get_object_or_404
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

# DRF Imports
from rest_framework.decorators import api_view
from rest_framework.response import Response

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
            
        d_str = d_obj.strftime('%d/%m/%Y')
        
        bp_value = (vital.blood_pressure or '').strip()
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

@api_view(['GET'])
def get_issued_tests(request, patient_id, camp_id):
    tests = list(
        # pyrefly: ignore [missing-attribute]
        TestIssue.objects.filter(
            patient_id=patient_id,
            camp__id=camp_id
        ).values_list('test__id', flat=True)
    )
    return Response(tests)

@api_view(['GET'])
def search_vitals(request, patient_id, camp_id):
    # pyrefly: ignore [missing-attribute]
    v = Vitals.objects.filter(
        patient_id=patient_id,
        camp__id=camp_id
    ).first()
    if v:
        serializer = VitalsSerializer(v)
        return Response(serializer.data)
    return Response({})

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

@api_view(['GET'])
def search_meds(request, med_id):
    # pyrefly: ignore [missing-attribute]
    med = Medicine.objects.filter(uqid=med_id).first()
    if med:
        serializer = MedicineSerializer(med)
        return Response(serializer.data)
    return Response({})



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

    # pyrefly: ignore [missing-attribute]
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



@api_view(['GET'])
def api_get_camps(request):
    # pyrefly: ignore [missing-attribute]
    camps = MedicalCamp.objects.all().order_by('id')
    serializer = MedicalCampSerializer(camps, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def api_get_medicines(request):
    # pyrefly: ignore [missing-attribute]
    medicines = Medicine.objects.all().order_by('uqid')
    serializer = MedicineSerializer(medicines, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def api_update_medicine_details(request):
    try:
        data = request.data
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
        
        return Response({
            'status': 'success',
            'message': 'Medicine details updated successfully'
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_add_medicine(request):
    try:
        data = request.data
        name = data.get('name')
        formulation = data.get('formulation', '')
        stock = int(data.get('stock', 0))
        custom_uqid = data.get('uqid')
        
        if not name:
            return Response({'status': 'error', 'message': 'Medicine name is required'}, status=400)
            
        if custom_uqid:
            try:
                custom_uqid = int(custom_uqid)
                # pyrefly: ignore [missing-attribute]
                if Medicine.objects.filter(uqid=custom_uqid).exists():
                    return Response({'status': 'error', 'message': f'Medicine with UQID {custom_uqid} already exists'}, status=400)
                new_uqid = custom_uqid
            except ValueError:
                return Response({'status': 'error', 'message': 'UQID must be a number'}, status=400)
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
        
        serializer = MedicineSerializer(medicine)
        return Response({
            'status': 'success',
            'message': 'Medicine added successfully',
            'medicine': serializer.data
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)


@api_view(['GET'])
def api_get_patient_details(request, patient_id):
    # pyrefly: ignore [missing-attribute]
    issues = PatientMedicineIssue.objects.filter(
        patient_id=patient_id
    ).order_by('-camp__date')
    
    serializer_issues = PatientMedicineIssueSerializer(issues, many=True)
    history = {}
    for issue in serializer_issues.data:
        camp_key = issue['camp_info']
        if camp_key not in history:
            history[camp_key] = {
                'vitals_id': issue['vitals_record'],
                'items': []
            }
        history[camp_key]['items'].append({
            'medicine': issue['medicine_name'],
            'qty': issue['qty']
        })

    # Fetch vitals from both old and new tables for backward compatibility
    # pyrefly: ignore [missing-attribute]
    old_vitals = Vitals.objects.filter(patient_id=patient_id)
    # pyrefly: ignore [missing-attribute]
    new_vitals = PatientVitals.objects.filter(patient_id=patient_id)
    
    combined_vitals = list(old_vitals) + list(new_vitals)
    
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
        sugar = (v.rbs or '').strip()
        hb = (v.haemoglobin or '').strip()
        
        has_data = any(val not in ["NA", "-", "", None] for val in [bp, sugar, hb])
        
        if has_data:
            display_date = 'N/A'
            if hasattr(v, 'date') and v.date:
                display_date = v.date.strftime('%d/%m/%Y')
            elif v.camp and v.camp.date:
                display_date = v.camp.date.strftime('%d/%m/%Y')

            vitals_list.append({
                'id': getattr(v, 'id', None),
                'camp': f"{v.camp.venue.name if v.camp and v.camp.venue else 'Unknown'} - {v.camp.number if v.camp else '?'}",
                'date': display_date,
                'blood_pressure': bp if bp not in ["NA", "-"] else "",
                'glucose': sugar if sugar not in ["NA", "-"] else "", # Keep key as 'glucose' for frontend compatibility but use rbs value
                'haemoglobin': hb if hb not in ["NA", "-"] else "",
                'weight': getattr(v, 'weight', ''),
                'height': getattr(v, 'height', ''),
                'pulse': getattr(v, 'pulse', ''),
                'is_old': not hasattr(v, 'diagnosis') # To distinguish between Vitals and PatientVitals
            })
            filtered_vitals_for_charts.append(v)

    charts = charts_data(filtered_vitals_for_charts)
    
    # Fetch demographic details
    patient_info = {}
    try:
        # pyrefly: ignore [missing-attribute]
        p = Patient.objects.get(patient_id=patient_id)
        serializer_patient = PatientSerializer(p)
        patient_info = serializer_patient.data
    # pyrefly: ignore [missing-attribute]
    except Patient.DoesNotExist:
        pass

    # Fetch issued tests
    issued_tests = TestIssue.objects.filter(patient_id=patient_id).select_related('test', 'camp', 'camp__venue')

    return Response({
        'patient_id': patient_id,
        'info': patient_info,
        'medicine_history': history,
        'issued_tests': TestIssueSerializer(issued_tests, many=True).data,
        'vitals': vitals_list,
        'charts': charts
    })

@api_view(['POST'])
@transaction.atomic
def api_issue_medicine(request):
    try:
        data = request.data
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
                return Response({
                    'status': 'error',
                    'message': f'Stock not allocated for {medicine.name}'
                }, status=400)
            if camp_stock.remaining_stock() < qty:
                return Response({
                    'status': 'error',
                    'message': f'Insufficient stock for {medicine.name}'
                }, status=400)
            # pyrefly: ignore [missing-attribute]
            issue = PatientMedicineIssue.objects.create(
                patient_id=patient_id,
                camp=camp,
                medicine=medicine,
                qty=qty,
                formulation=item.get('formulation'),
                strength=item.get('strength'),
                days=int(item.get('days') or 0)
            )
            # Update used stock in camp wise stock
            camp_stock.used_stock += qty
            camp_stock.save()

        return Response({'status': 'success'})
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_save_vitals(request):
    try:
        data = request.data
        patient_id = data.get('patient_id')
        camp_id = data.get('medical_camp')
        
        if not camp_id:
            return Response({'status': 'error', 'message': 'Medical camp session is required.'}, status=400)
        
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        
        # Helper to safely parse int from potential OCR strings
        def safe_int(val, default=0):
            try:
                if val is None or str(val).strip() == '':
                    return default
                # Remove non-numeric characters if it's a string like "2 days"
                clean_val = ''.join(filter(str.isdigit, str(val)))
                return int(clean_val) if clean_val else default
            except:
                return default

        # Create the vitals record
        # pyrefly: ignore [missing-attribute]
        v = PatientVitals.objects.create(
            patient_id=safe_int(patient_id),
            camp=camp,
            date=data.get('date'),
            time=data.get('time'),
            e_no=data.get('e_no'),
            weight=data.get('weight'),
            height=data.get('height'),
            blood_pressure=data.get('blood_pressure'),
            pulse=data.get('pulse'),
            rbs=data.get('rbs'),
            haemoglobin=data.get('haemoglobin'),
            last_food_time=data.get('last_food_time'),
            dr_name=data.get('dr_name'),
            dr_id=data.get('dr_id'),
            diagnosis=data.get('diagnosis')
        )

        # Handle medicines
        med_issues = data.get('medicines', [])
        for item in med_issues:
            med_id = item.get('msNo')
            qty = safe_int(item.get('quantity'))
            
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
                        return Response({
                            'status': 'error', 
                            'message': f'Stock not allocated for {medicine.name} at this camp. Please allocate stock first.'
                        }, status=400)
                    
                    if camp_stock.remaining_stock() < qty:
                        v.delete()
                        return Response({
                            'status': 'error', 
                            'message': f'Insufficient stock for {medicine.name}. Available: {camp_stock.remaining_stock()}'
                        }, status=400)
                    
                    # pyrefly: ignore [missing-attribute]
                    PatientMedicineIssue.objects.create(
                        patient_id=safe_int(patient_id),
                        camp=camp,
                        medicine=medicine,
                        qty=qty,
                        vitals_record=v,
                        formulation=item.get('formulation'),
                        strength=item.get('strength'),
                        days=safe_int(item.get('days')),
                        morning=safe_int(item.get('morning')),
                        afternoon=safe_int(item.get('afternoon')),
                        night=safe_int(item.get('night'))
                    )
                    
                    # Update used stock
                    camp_stock.used_stock += qty
                    camp_stock.save()

        # Handle tests
        selected_tests = data.get('selected_tests', [])
        for test_id in selected_tests:
            # pyrefly: ignore [missing-attribute]
            test = MedicalTest.objects.filter(test_id=test_id).first()
            if test:
                # pyrefly: ignore [missing-attribute]
                TestIssue.objects.create(
                    patient_id=safe_int(patient_id),
                    camp=camp,
                    test=test,
                    vitals_record=v
                )

        return Response({'status': 'success', 'message': 'Vitals and medicines saved successfully'})

    except Exception as e:
        return Response({
            'status': 'error',
            'message': f"System error while saving: {str(e)}"
        }, status=400)

@api_view(['GET'])
def api_get_visit_details(request, vitals_id):
    try:
        vitals = get_object_or_404(PatientVitals, id=vitals_id)
        serializer_vitals = PatientVitalsSerializer(vitals)
        
        # Get medicines: Try vitals_record first, fallback to patient+camp for legacy records
        medicines = PatientMedicineIssue.objects.filter(vitals_record=vitals)
        if not medicines.exists():
            medicines = PatientMedicineIssue.objects.filter(patient_id=vitals.patient_id, camp=vitals.camp)
            
        serializer_meds = PatientMedicineIssueSerializer(medicines, many=True)
        
        # Get tests: Same logic for tests
        tests = TestIssue.objects.filter(vitals_record=vitals)
        if not tests.exists():
             tests = TestIssue.objects.filter(patient_id=vitals.patient_id, camp=vitals.camp)
        
        test_ids = [t.test.test_id for t in tests]
        
        return Response({
            'status': 'success',
            'vitals': serializer_vitals.data,
            'medicines': serializer_meds.data,
            'test_ids': test_ids
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@api_view(['POST', 'DELETE'])
@transaction.atomic
def api_delete_visit(request, vitals_id):
    try:
        # Try PatientVitals first
        v = PatientVitals.objects.filter(id=vitals_id).first()
        is_legacy = False
        
        if not v:
            # Try legacy Vitals table
            v = Vitals.objects.filter(id=vitals_id).first()
            is_legacy = True
            
        if not v:
            return Response({'status': 'error', 'message': f"Visit ID {vitals_id} not found in any record table."}, status=404)

        camp = v.camp
        
        # 1. Revert medicine stock and delete issues
        # (Only PatientVitals have linked issues in the new system, but we check anyway)
        issues = PatientMedicineIssue.objects.filter(vitals_record_id=v.id) if not is_legacy else []
        for issue in issues:
            cs = CampWiseStock.objects.filter(camp=camp, medicine=issue.medicine).first()
            if cs:
                cs.used_stock = max(0, cs.used_stock - issue.qty)
                cs.save()
            issue.delete()
            
        # 2. Delete test issues
        if not is_legacy:
            TestIssue.objects.filter(vitals_record_id=v.id).delete()
        
        # 3. Delete vitals
        v.delete()
        
        return Response({'status': 'success', 'message': 'Visit deleted successfully'})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return Response({'status': 'error', 'message': f"Delete failed: {str(e)}"}, status=400)

@api_view(['POST'])
@transaction.atomic
def api_update_visit_details(request, vitals_id):
    try:
        data = request.data
        v = get_object_or_404(PatientVitals, id=vitals_id)
        camp = v.camp
        
        # Helper to safely parse int
        def safe_int(val, default=0):
            try:
                if val is None or str(val).strip() == '': return default
                clean_val = ''.join(filter(str.isdigit, str(val)))
                return int(clean_val) if clean_val else default
            except: return default

        # 1. Update Vitals
        from datetime import datetime
        date_str = data.get('date', '').strip()
        if date_str and '/' in date_str:
            try:
                v.date = datetime.strptime(date_str, '%d/%m/%Y').date()
            except:
                pass # Keep original if invalid
        elif not date_str:
            v.date = None

        v.time = data.get('time', v.time)
        v.weight = data.get('weight', v.weight)
        v.height = data.get('height', v.height)
        v.blood_pressure = data.get('blood_pressure', v.blood_pressure)
        v.pulse = data.get('pulse', v.pulse)
        v.rbs = data.get('rbs', v.rbs)
        v.haemoglobin = data.get('haemoglobin', v.haemoglobin)
        v.last_food_time = data.get('last_food_time', v.last_food_time)
        v.dr_name = data.get('dr_name', v.dr_name)
        v.dr_id = data.get('dr_id', v.dr_id)
        v.diagnosis = data.get('diagnosis', v.diagnosis)
        v.save()

        # 2. Update Medicines (Smarter Reconciliation)
        new_med_data = data.get('medicines', [])
        existing_issues = {issue.id: issue for issue in PatientMedicineIssue.objects.filter(vitals_record=v)}
        kept_ids = []
        
        for item in new_med_data:
            med_id_val = item.get('msNo') or item.get('medicine')
            qty = safe_int(item.get('qty') or item.get('quantity'))
            if not med_id_val or qty <= 0: continue
            
            # Find medicine
            medicine = None
            if str(med_id_val).isdigit():
                medicine = Medicine.objects.filter(uqid=int(med_id_val)).first()
            if not medicine:
                medicine = Medicine.objects.filter(name=med_id_val).first()
            if not medicine: continue
            
            # Match with existing
            match = None
            for eid, eissue in existing_issues.items():
                if eid not in kept_ids and eissue.medicine == medicine:
                    match = eissue
                    break
            
            if match:
                # Update existing
                diff = qty - match.qty
                cs = CampWiseStock.objects.filter(camp=camp, medicine=medicine).first()
                if cs:
                    cs.used_stock += diff
                    cs.save()
                
                match.qty = qty
                match.days = safe_int(item.get('days'))
                match.morning = safe_int(item.get('morning'))
                match.afternoon = safe_int(item.get('afternoon'))
                match.night = safe_int(item.get('night'))
                match.formulation = item.get('formulation')
                match.strength = item.get('strength')
                match.save()
                kept_ids.append(match.id)
            else:
                # New record
                PatientMedicineIssue.objects.create(
                    patient_id=v.patient_id,
                    camp=camp,
                    medicine=medicine,
                    qty=qty,
                    vitals_record=v,
                    formulation=item.get('formulation'),
                    strength=item.get('strength'),
                    days=safe_int(item.get('days')),
                    morning=safe_int(item.get('morning')),
                    afternoon=safe_int(item.get('afternoon')),
                    night=safe_int(item.get('night'))
                )
                cs = CampWiseStock.objects.filter(camp=camp, medicine=medicine).first()
                if cs:
                    cs.used_stock += qty
                    cs.save()
        
        # Cleanup
        for eid, eissue in existing_issues.items():
            if eid not in kept_ids:
                cs = CampWiseStock.objects.filter(camp=camp, medicine=eissue.medicine).first()
                if cs:
                    cs.used_stock = max(0, cs.used_stock - eissue.qty)
                    cs.save()
                eissue.delete()

        # 3. Update Tests
        TestIssue.objects.filter(vitals_record=v).delete()
        selected_tests = data.get('selected_tests', [])
        for tid in selected_tests:
            test = MedicalTest.objects.filter(test_id=tid).first()
            if test:
                TestIssue.objects.create(patient_id=v.patient_id, camp=camp, test=test, vitals_record=v)

        return Response({'status': 'success', 'message': 'Visit details updated successfully'})
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@api_view(['POST'])
@transaction.atomic
def api_register_patient(request):
    try:
        data = request.data
        defaults_data = {
            'patient_name': data.get('name'),
            'patient_gender': data.get('gender'),
            'patient_addr': data.get('address'),
            'patient_age': data.get('age'),
            'contact_no': data.get('contact'),
        }
        
        if data.get('camp_session'):
            camp_num = data.get('camp_session')
            defaults_data['camp_session'] = camp_num
            # Auto-sync registered_date with the camp's actual date
            # pyrefly: ignore [missing-attribute]
            camp_obj = MedicalCamp.objects.filter(number=camp_num).first()
            if camp_obj:
                defaults_data['registered_date'] = camp_obj.date
        
        if data.get('regdate') and 'registered_date' not in defaults_data:
            defaults_data['registered_date'] = data.get('regdate')


        # pyrefly: ignore [missing-attribute]
        patient, created = Patient.objects.update_or_create(
            patient_id=data.get('pid'),
            defaults=defaults_data
        )
        serializer = PatientSerializer(patient)
        return Response({
            'status': 'success',
            'patient_id': patient.patient_id,
            'patient': serializer.data
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['GET'])
def api_get_doctor(request, doctor_id):
    try:
        # pyrefly: ignore [missing-attribute, unknown-name]
        doctor = Doctor.objects.get(id=doctor_id)
        serializer = DoctorSerializer(doctor)
        return Response({
            'status': 'success',
            'name': doctor.name,
            'specialization': doctor.specialization or '',
            'data': serializer.data
        })
    # pyrefly: ignore [missing-attribute, unknown-name]
    except Doctor.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Doctor not found'
        }, status=404)

@api_view(['POST'])
@csrf_exempt
def api_login(request):
    try:
        data = request.data
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
                
            return Response({
                'status': 'success',
                'message': 'Login successful',
                'role': role
            })
        return Response({
            'status': 'error',
            'message': 'Invalid credentials'
        }, status=401)
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['GET'])
def api_check_patient_id(request, pid):
    # pyrefly: ignore [missing-attribute]
    exists = Patient.objects.filter(
        patient_id=pid
    ).exists()
    return Response({'exists': exists})

@api_view(['POST'])
@transaction.atomic
def api_update_medicine_stock(request):
    try:
        data = request.data
        uqid = data.get('uqid')
        added_qty = int(data.get('added_qty', 0))
        medicine = get_object_or_404(Medicine, uqid=uqid)
        medicine.stock += added_qty
        medicine.save()
        return Response({
            'status': 'success',
            'new_stock': medicine.stock,
            'medicine_name': medicine.name
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_set_medicine_stock(request):
    try:
        data = request.data
        uqid = data.get('uqid')
        new_stock = int(data.get('stock', 0))
        if new_stock < 0:
            return Response({
                'status': 'error',
                'message': 'Stock cannot be negative.'
            }, status=400)
        medicine = get_object_or_404(Medicine, uqid=uqid)
        medicine.stock = new_stock
        medicine.save()
        return Response({
            'status': 'success',
            'new_stock': medicine.stock,
            'medicine_name': medicine.name
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['GET'])
def api_get_camp_wise_stock(request):
    # pyrefly: ignore [missing-attribute]
    stocks = CampWiseStock.objects.select_related('medicine', 'camp')
    serializer = CampWiseStockSerializer(stocks, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def api_get_specific_camp_stock(request, camp_id):
    try:
        # Fetch camp first to ensure it exists and to get its number
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        # pyrefly: ignore [missing-attribute]
        stocks = CampWiseStock.objects.filter(camp=camp)
        serializer = CampWiseStockSerializer(stocks, many=True)
        # Custom format to match frontend expectation
        data = {}
        for s in serializer.data:
            data[s['medicine_uqid']] = {
                'allocated': s['allocated_stock'],
                'used': s['used_stock'],
                'remaining': s['remaining']
            }
        return Response(data)
    except Exception as e:
        return Response({
            'status': 'error',
            'message': f"Error fetching camp stock: {str(e)}"
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_allocate_to_camp(request):
    try:
        data = request.data
        camp_id = data.get('camp_id')
        uqid = data.get('uqid')
        qty_str = data.get('qty', '0')
        qty = int(qty_str) if qty_str and str(qty_str).isdigit() else 0
        
        if qty <= 0:
            return Response({
                'status': 'error',
                'message': 'Please enter a valid quantity greater than zero.'
            }, status=400)

        camp = get_object_or_404(MedicalCamp, id=camp_id)
        medicine = get_object_or_404(Medicine, uqid=uqid)
        
        if medicine.stock < qty:
            return Response({
                'status': 'error',
                'message': f'Insufficient stock in warehouse. Available: {medicine.stock}'
            }, status=400)
        
        # pyrefly: ignore [missing-attribute]
        camp_stock, created = CampWiseStock.objects.get_or_create(
            camp=camp,
            medicine=medicine,
            defaults={'allocated_stock': 0, 'used_stock': 0}
        )
        medicine.stock -= qty
        medicine.save()
        camp_stock.allocated_stock += qty
        camp_stock.save()
        
        return Response({
            'status': 'success',
            'medicine_name': medicine.name,
            'new_total_stock': medicine.stock,
            'new_camp_stock': camp_stock.allocated_stock
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': f"Allocation failed: {str(e)}"
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_set_camp_allocation(request):
    try:
        data = request.data
        camp_id = data.get('camp_id')
        uqid = data.get('uqid')
        qty = int(data.get('qty', 0))
        if qty < 0:
            return Response({
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
            return Response({
                'status': 'error',
                'message': f'Cannot allocate less than used stock ({camp_stock.used_stock})'
            }, status=400)
        diff = qty - camp_stock.allocated_stock
        if diff > 0 and medicine.stock < diff:
            return Response({
                'status': 'error',
                'message': f'Insufficient central stock. Available: {medicine.stock}'
            }, status=400)
        medicine.stock -= diff
        medicine.save()
        camp_stock.allocated_stock = qty
        camp_stock.save()
        return Response({
            'status': 'success',
            'new_allocation': qty,
            'central_stock': medicine.stock
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_return_to_warehouse(request):
    try:
        data = request.data
        camp_id = data.get('camp_id')
        med_id = data.get('med_id')
        
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        # pyrefly: ignore [missing-attribute]
        camp_stock = get_object_or_404(CampWiseStock, camp=camp, medicine__uqid=med_id)
        
        remaining = camp_stock.remaining_stock()
        medicine = camp_stock.medicine
        if remaining > 0:
            medicine.stock += remaining
            medicine.save()
        camp_stock.allocated_stock = 0
        camp_stock.used_stock = 0
        camp_stock.save()
        return Response({
            'status': 'success',
            'new_total': medicine.stock
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_close_camp_session(request):
    try:
        data = request.data
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
        return Response({
            'status': 'success',
            'message': 'Camp session closed and stock returned to warehouse'
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_register_camp(request):
    try:
        data = request.data
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
        serializer = MedicalCampSerializer(camp)
        return Response({
            'status': 'success',
            'message': f'Camp {camp_number} at {venue_name} registered successfully',
            'camp_id': camp.id,
            'camp': serializer.data
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['GET'])
def api_get_medical_tests(request):
    # pyrefly: ignore [missing-attribute]
    tests = MedicalTest.objects.all().order_by('test_id')
    serializer = MedicalTestSerializer(tests, many=True)
    # Custom format to match frontend expectation of float values
    data = []
    for t in serializer.data:
        data.append({
            'id': t['id'],
            'test_id': t['test_id'],
            'name': t['name'],
            'actual_cost': float(t['actual_cost']),
            'patient_cost': float(t['patient_cost']),
        })
    return Response(data)

@api_view(['GET'])
def api_camp_patients(request, camp_id):
    try:
        # pyrefly: ignore [missing-attribute]
        camp = MedicalCamp.objects.get(id=camp_id)
    # pyrefly: ignore [missing-attribute]
    except MedicalCamp.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Camp not found'
        }, status=404)
    
    # Efficiently get all patient IDs related to this camp
    # pyrefly: ignore [missing-attribute]
    vitals_pids = PatientVitals.objects.filter(camp=camp).values_list('patient_id', flat=True)
    # pyrefly: ignore [missing-attribute]
    issue_pids = PatientMedicineIssue.objects.filter(camp=camp).values_list('patient_id', flat=True)
    # pyrefly: ignore [missing-attribute]
    test_pids = TestIssue.objects.filter(camp=camp).values_list('patient_id', flat=True)
    # pyrefly: ignore [missing-attribute]
    registered_pids = Patient.objects.filter(camp_session=camp.number).values_list('patient_id', flat=True)
    
    all_pids = set(vitals_pids) | set(issue_pids) | set(test_pids) | set(registered_pids)
    
    # Fetch all relevant patients at once
    # pyrefly: ignore [missing-attribute]
    patients = Patient.objects.filter(patient_id__in=all_pids)
    patient_serializer = PatientSerializer(patients, many=True)
    patient_map = {p['patient_id']: p for p in patient_serializer.data}

    result = []
    for pid in sorted(all_pids):
        # pyrefly: ignore [missing-attribute]
        issues = PatientMedicineIssue.objects.filter(patient_id=pid, camp=camp)
        med_serializer = PatientMedicineIssueSerializer(issues, many=True)
        
        # pyrefly: ignore [missing-attribute]
        test_issues = TestIssue.objects.filter(patient_id=pid, camp=camp)
        test_serializer = TestIssueSerializer(test_issues, many=True)
        
        p_data = patient_map.get(pid, {})
        result.append({
            'patient_id': pid,
            'patient_name': p_data.get('name', ''),
            'age': p_data.get('age', ''),
            'gender': p_data.get('gender', ''),
            'contact': p_data.get('contact', ''),
            'address': p_data.get('address', ''),
            'registered_date': p_data.get('registered_date', ''),
            'medicines': med_serializer.data,
            'tests': test_serializer.data,
        })
    return Response(result)

@csrf_exempt
@require_http_methods(["POST"])
@api_view(['POST'])
def api_update_test_record(request):
    try:
        data = request.data
        test_issue_id = data.get('test_issue_id')
        reports_issued = data.get('reports_issued')
        test_issue = get_object_or_404(TestIssue, id=test_issue_id)
        test_issue.reports_issued = bool(reports_issued)
        test_issue.save()
        return Response({
            'status': 'success',
            'reports_issued': test_issue.reports_issued
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@api_view(['POST'])
def api_create_scan_session(request):
    # pyrefly: ignore [missing-attribute]
    session = ScanSession.objects.create()
    serializer = ScanSessionSerializer(session)
    return Response({
        'status': 'success',
        'session_id': str(session.session_id),
        'session': serializer.data
    })

import time
import json
import os
from django.conf import settings

def log_benchmark(session_uuid, image_path, time_taken, status, data, raw_text, error=None):
    try:
        # Save benchmark file in the root directory (medical_camp/)
        benchmark_file = os.path.join(settings.BASE_DIR, 'benchmark_ocr.json')
        benchmark_data = []
        if os.path.exists(benchmark_file):
            try:
                with open(benchmark_file, 'r', encoding='utf-8') as f:
                    benchmark_data = json.load(f)
            except json.JSONDecodeError:
                pass
                
        entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "session_id": str(session_uuid),
            "image_path": str(image_path),
            "status": status,
            "time_taken_seconds": round(time_taken, 2),
            "accuracy_score": None, # For manual grading later
            "error_message": str(error) if error else None,
            "extracted_data": data,
            "raw_text_length": len(raw_text) if raw_text else 0
        }
        
        benchmark_data.append(entry)
        
        with open(benchmark_file, 'w', encoding='utf-8') as f:
            json.dump(benchmark_data, f, indent=4)
    except Exception as e:
        print(f"Failed to write benchmark: {e}")

def run_ocr_task(session_uuid):
    """Background task to process OCR"""
    try:
        close_old_connections()
        print(f"DEBUG: OCR Task started for session {session_uuid}")
        # pyrefly: ignore [missing-attribute]
        session = ScanSession.objects.get(session_id=session_uuid)
        session.ocr_status = 'processing'
        session.save()
        
        # Trigger OCR
        print(f"DEBUG: Triggering OCR for {session.image.path}")
        start_time = time.time()
        structured_data, raw_text = ocr_service.process_report(session.image.path)
        end_time = time.time()
        time_taken = end_time - start_time
        
        print(f"DEBUG: OCR completed for {session_uuid} in {time_taken:.2f}s, saving results...")
        session.ocr_data = structured_data
        session.ocr_raw_text = raw_text
        session.ocr_status = 'completed'
        session.save()
        
        # Log to benchmark file
        log_benchmark(session_uuid, session.image.path, time_taken, 'completed', structured_data, raw_text)
        
        print(f"DEBUG: Session {session_uuid} updated to completed.")
    except Exception as e:
        print(f"OCR Task Error for {session_uuid}: {e}")
        try:
            close_old_connections()
            # pyrefly: ignore [missing-attribute]
            session = ScanSession.objects.get(session_id=session_uuid)
            session.ocr_status = 'error'
            session.save()
            
            # Log error to benchmark file
            log_benchmark(session_uuid, session.image.path if session.image else 'Unknown', 0, 'error', None, None, str(e))
        except Exception as e2:
            print(f"OCR Error status update failed: {e2}")
    finally:
        close_old_connections()

@csrf_exempt
@api_view(['POST'])
def api_upload_scan(request, session_id):
    if request.FILES.get('image'):
        try:
            # pyrefly: ignore [missing-attribute]
            session = ScanSession.objects.get(session_id=session_id)
            if session.is_completed:
                return Response({'status': 'error', 'message': 'Session already completed'}, status=400)
            
            session.image = request.FILES['image']
            session.is_completed = True
            session.save()

            # Start OCR in background thread
            threading.Thread(target=run_ocr_task, args=(session.session_id,)).start()

            return Response({'status': 'success', 'message': 'Image uploaded successfully'})
        # pyrefly: ignore [missing-attribute]
        except ScanSession.DoesNotExist:
            return Response({'status': 'error', 'message': 'Invalid session'}, status=404)
    return Response({'status': 'error', 'message': 'No image provided'}, status=400)

@api_view(['GET'])
def api_check_scan_status(request, session_id):
    try:
        # pyrefly: ignore [missing-attribute]
        session = ScanSession.objects.get(session_id=session_id)
        return Response({
            'status': 'success',
            'is_completed': session.is_completed,
            'image_url': request.build_absolute_uri(session.image.url) if session.image else None,
            'ocr_status': session.ocr_status,
            'ocr_data': session.ocr_data,
            'ocr_raw_text': session.ocr_raw_text
        })
    # pyrefly: ignore [missing-attribute]
    except ScanSession.DoesNotExist:
        return Response({'status': 'error', 'message': 'Invalid session'}, status=404)

@api_view(['GET'])
def api_get_doctors(request):
    # pyrefly: ignore [missing-attribute]
    doctors = Doctor.objects.all().order_by('id')
    serializer = DoctorSerializer(doctors, many=True)
    # Custom map to match frontend keys
    data = []
    for dr in serializer.data:
        data.append({
            'dr_id': str(dr['id']),
            'dr_name': dr['name'],
            'specialization': dr['specialization'] or '',
            'is_present': dr['is_present'],
        })
    return Response(data)





@csrf_exempt
@require_http_methods(["POST"])
@api_view(['POST'])
@transaction.atomic
def api_add_doctor(request):
    try:
        data = request.data
        name = data.get('name')
        specialization = data.get('specialization')
        
        if not name:
            return Response({'status': 'error', 'message': 'Doctor name is required'}, status=400)
            
        # pyrefly: ignore [missing-attribute]
        doctor = Doctor.objects.create(
            name=name,
            specialization=specialization
        )
        
        return Response({
            'status': 'success',
            'doctor_id': doctor.id,
            'message': 'Doctor registered successfully'
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
@api_view(['POST'])
@transaction.atomic
def api_update_doctor(request):
    try:
        data = request.data
        dr_id = data.get('dr_id')
        name = data.get('dr_name')
        specialization = data.get('specialization')
        
        doctor = get_object_or_404(Doctor, id=dr_id)
        doctor.name = name
        doctor.specialization = specialization
        doctor.save()
        
        return Response({
            'status': 'success',
            'message': 'Doctor details updated successfully'
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
@require_http_methods(["DELETE", "POST"])
@api_view(['DELETE', 'POST'])
def api_delete_doctor(request, doctor_id):
    try:
        doctor = get_object_or_404(Doctor, id=doctor_id)
        doctor.delete()
        return Response({
            'status': 'success',
            'message': 'Doctor deleted successfully'
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
@api_view(['POST'])
def api_toggle_doctor_presence(request, doctor_id):
    try:
        doctor = get_object_or_404(Doctor, id=doctor_id)
        doctor.is_present = not doctor.is_present
        doctor.save()
        return Response({
            'status': 'success',
            'is_present': doctor.is_present,
            'message': f'Doctor marked as {"present" if doctor.is_present else "absent"}'
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@api_view(['GET'])
def api_doctor_analytics(request):
    # pyrefly: ignore [untyped-import]
    from django.db.models import Count
    # Group by doctor and camp
    # pyrefly: ignore [missing-attribute]
    stats = PatientVitals.objects.values(
        'dr_name', 
        'dr_id', 
        'camp__number', 
        'camp__venue__name'
    ).annotate(
        patient_count=Count('patient_id', distinct=True)
    ).order_by('dr_name', 'camp__number')
    
    return Response(list(stats))

@api_view(['GET'])
def api_get_camp_details(request, camp_id):
    # pyrefly: ignore [untyped-import]
    from django.db.models import Count
    camp = get_object_or_404(MedicalCamp, id=camp_id)
    
    # pyrefly: ignore [missing-attribute]
    vitals = PatientVitals.objects.filter(camp=camp.number).order_by('dr_name')
    
    doctors_map = {}
    for v in vitals:
        dr_key = v.dr_name or "Unknown Doctor"
        if dr_key not in doctors_map:
            doctors_map[dr_key] = []
            
        # pyrefly: ignore [missing-attribute]
        meds = PatientMedicineIssue.objects.filter(patient_id=v.patient_id, camp=camp.number).values_list('medicine__name', flat=True)
        # pyrefly: ignore [missing-attribute]
        tests = TestIssue.objects.filter(patient_id=v.patient_id, camp=camp.number).values_list('test__name', flat=True)
        # pyrefly: ignore [missing-attribute]
        p_obj = Patient.objects.filter(patient_id=v.patient_id).first()
        p_name = p_obj.patient_name if p_obj else f"Patient {v.patient_id}"

        doctors_map[dr_key].append({
            'patient_name': p_name,
            'medications': list(meds),
            'tests': list(tests)
        })
    
    data = {
        'camp_number': camp.number,
        'venue': camp.venue.name if camp.venue else "N/A",
        'doctors': []
    }
    
    for dr_name, patients in doctors_map.items():
        data['doctors'].append({
            'dr_name': dr_name,
            'patients': patients
        })
        
    return Response(data)

@api_view(['GET'])
def api_get_all_camps(request):
    # pyrefly: ignore [missing-attribute]
    camps = MedicalCamp.objects.all().order_by('-number')
    serializer = MedicalCampSerializer(camps, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def api_get_camp_report(request,camp_id):
    try:

        camp=MedicalCamp.objects.get(number=camp_id)
        
        # 1. Get IDs from Vitals
        vitals_ids = PatientVitals.objects.filter(camp=camp).values_list('patient_id', flat=True)

        # 2. Get IDs from Medicine Issue
        medicine_ids = PatientMedicineIssue.objects.filter(camp=camp).values_list('patient_id', flat=True)

        # 3. Get IDs from Test Issue
        test_ids = TestIssue.objects.filter(camp=camp).values_list('patient_id', flat=True)

        # 4. Combine them and remove duplicates (set)
        # This will find everyone who did ANYTHING at the camp
        attended_patient_ids = set(list(vitals_ids) + list(medicine_ids) + list(test_ids))

        total_patients = len(attended_patient_ids)


        total_patients = len(attended_patient_ids)

        new_patients= Patient.objects.filter(patient_id__in=attended_patient_ids,camp_session=camp_id).count()

        old_patients=total_patients - new_patients

        # 4. Get Doctors who attended (Unique by dr_id)
        doctors_query = PatientVitals.objects.filter(camp=camp).values('dr_id', 'dr_name').distinct()
        
        unique_doctors = {}
        for d in doctors_query:
            if d['dr_id']:
                unique_doctors[d['dr_id']] = d['dr_name'] or "Unknown Doctor"
        
        doctor_names = list(unique_doctors.values())
        total_doctors = len(unique_doctors)

        stock_data=CampWiseStock.objects.filter(camp=camp)

        total_allocated = sum(s.allocated_stock for s in stock_data)

        total_used=sum(s.used_stock for s in stock_data)

        remaining_stock=total_allocated-total_used

        total_tests= TestIssue.objects.filter(camp=camp).count()

        report_data = {
            "camp_number":camp.number,
            "venue":camp.venue.name,
            "date":camp.date,
            "patients":{
                "total":total_patients,
                "new":new_patients,
                "old":old_patients,
            },
            "doctors":{
                "count":total_doctors,
                "names":doctor_names,
            },
            "medicine":{
                "allocated":total_allocated,
                "used":total_used,
                "remaining":remaining_stock,
            },
            "tests":{
                "total_issued":total_tests,
            },
            
            
        }

        return Response(report_data)
        
    except MedicalCamp.DoesNotExist:
        return Response({"error": "Camp not found"}, status=404)

       


       
        

    
        
        