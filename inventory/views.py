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
    CampWiseDoctor,
    PatientCampVisit
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
        
        bp_value = (getattr(vital, 'blood_pressure', '') or '').strip()
        glucose_value = (getattr(vital, 'rbs', '') or '').strip()
        hb_value = (getattr(vital, 'haemoglobin', '') or '').strip()
        
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
        # pyrefly: ignore [missing-attribute]
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
    camp = MedicalCamp.objects.filter(number=camp_id).first()
    if not camp:
        camp = MedicalCamp.objects.filter(id=camp_id).first()
    if not camp:
        from django.http import Http404
        raise Http404("No MedicalCamp matches the given query.")
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
        'Formulation',
        'Company Name',
        'Expiry Date',
        'Warehouse Stock',
        'Allocated Stock',
        'Used Stock',
        'Remaining Stock',
        'Unit Cost (₹)',
        'Total Cost (₹)'
    ])

    # pyrefly: ignore [missing-attribute]
    stocks = CampWiseStock.objects.filter(camp=camp).select_related('medicine').order_by('medicine__uqid')
    
    for s in stocks:
        unit_cost = float(s.unit_cost if s.unit_cost is not None else (s.medicine.cost or 0))
        total_cost = s.used_stock * unit_cost
        writer.writerow([
            camp.number,
            camp.venue.name,
            camp.date.strftime('%Y-%m-%d'),
            s.medicine.uqid,
            s.medicine.name,
            s.medicine.formulation or '',
            s.company_name or '',
            s.expiry_date.strftime('%Y-%m-%d') if s.expiry_date else '',
            s.medicine.stock,
            s.allocated_stock,
            s.used_stock,
            s.remaining_stock(),
            f"{unit_cost:.2f}",
            f"{total_cost:.2f}"
        ])
    
    return response

def export_camp_report(request, camp_id):
    camp = MedicalCamp.objects.filter(number=camp_id).first()
    if not camp:
        camp = MedicalCamp.objects.filter(id=camp_id).first()
    if not camp:
        from django.http import Http404
        raise Http404("No MedicalCamp matches the given query.")
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="Camp_{camp.number}_Clinical_Report_{camp.date}.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Patient ID', 'Name', 'Age', 'Gender', 'Contact', 
        'BP', 'Sugar(RBS)', 'Hb', 'Weight', 'Height', 'Pulse',
        'Diagnosis', 'Doctor Name', 'Doctor ID', 
        'Medicines Issued', 'Lab Tests Issued', 'Visit Date'
    ])

    # Fetch all vitals for this camp
    # pyrefly: ignore [missing-attribute]
    vitals = PatientVitals.objects.filter(camp=camp).order_by('id')
    
    for v in vitals:
        # Get Patient info (using try-except for robustness)
        # pyrefly: ignore [missing-attribute]
        p = Patient.objects.filter(patient_id=v.patient_id).first()
        
        # Get Medicines
        # pyrefly: ignore [missing-attribute]
        meds = PatientMedicineIssue.objects.filter(vitals_record=v).select_related('medicine')
        med_list = ", ".join([f"{m.medicine.name} ({m.qty})" for m in meds])
        
        # Get Lab Tests
        # pyrefly: ignore [missing-attribute]
        tests = TestIssue.objects.filter(vitals_record=v).select_related('test')
        test_list = ", ".join([t.test.name for t in tests])

        writer.writerow([
            v.patient_id,   
            p.patient_name if p else "Unknown",
            p.patient_age if p else "N/A",
            p.patient_gender if p else "N/A",
            p.contact_no if p else "N/A",
            v.blood_pressure or "-",
            v.rbs or "-",
            v.haemoglobin or "-",
            v.weight or "-",
            v.height or "-",
            v.pulse or "-",
            v.diagnosis or "-",
            v.dr_name or "-",
            v.dr_id or "-",
            med_list or "None",
            test_list or "None",
            camp.date.strftime('%d/%m/%Y') if camp.date else (v.date.strftime('%d/%m/%Y') if v.date else "-")
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
        cost_val = None
        if cost is not None and cost != '':
            cost_val = float(cost)
        
        medicine.cost = cost_val
        
        # Handle expiry date
        expiry = data.get('expiry_date')
        if expiry and expiry.strip():
            medicine.expiry_date = expiry
        else:
            medicine.expiry_date = None
            
        medicine.save()
        
        # Sync all camp wise stock records
        CampWiseStock.objects.filter(medicine=medicine).update(unit_cost=cost_val)
        
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
def api_update_camp_medicine_details(request):
    try:
        data = request.data
        camp_id = data.get('camp_id')
        uqid = data.get('uqid')
        company_name = data.get('company_name')
        expiry = data.get('expiry_date')
        
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        medicine = get_object_or_404(Medicine, uqid=uqid)
        
        camp_stock, created = CampWiseStock.objects.get_or_create(
            camp=camp,
            medicine=medicine,
            defaults={'allocated_stock': 0, 'used_stock': 0}
        )
        
        camp_stock.company_name = company_name if company_name else None
        
        if expiry and expiry.strip():
            camp_stock.expiry_date = expiry
        else:
            camp_stock.expiry_date = None
            
        camp_stock.save()
        
        return Response({
            'status': 'success',
            'message': 'Camp-wise medicine details updated successfully'
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_update_medicine_profile(request):
    try:
        data = request.data
        old_uqid = data.get('old_uqid')
        new_uqid = data.get('new_uqid')
        name = data.get('name')
        cost = data.get('cost')
        formulation = data.get('formulation')
        
        if not old_uqid or not new_uqid or not name:
            return Response({'status': 'error', 'message': 'Required fields are missing.'}, status=400)
            
        # If UQID is changing, verify the new UQID doesn't already exist and update related foreign keys
        if int(old_uqid) != int(new_uqid):
            # pyrefly: ignore [missing-attribute]
            if Medicine.objects.filter(uqid=new_uqid).exists():
                return Response({'status': 'error', 'message': f'Medicine with UQID {new_uqid} already exists.'}, status=400)
            
            from django.db import connection
            with connection.cursor() as cursor:
                # Temporarily disable foreign key constraints in SQLite during transaction
                cursor.execute("PRAGMA foreign_keys = OFF;")
                
                # Update Medicine table
                cursor.execute("UPDATE inventory_medicine SET uqid = %s WHERE uqid = %s;", [new_uqid, old_uqid])
                
                # Update related tables referencing uqid
                cursor.execute("UPDATE inventory_patientmedicineissue SET medicine_id = %s WHERE medicine_id = %s;", [new_uqid, old_uqid])
                cursor.execute("UPDATE inventory_campwisestock SET medicine_id = %s WHERE medicine_id = %s;", [new_uqid, old_uqid])
                
                # Re-enable foreign key checks
                cursor.execute("PRAGMA foreign_keys = ON;")
            
            # Retrieve updated instance using the new UQID
            medicine = get_object_or_404(Medicine, uqid=new_uqid)
        else:
            medicine = get_object_or_404(Medicine, uqid=old_uqid)
        
        # Update name, formulation and cost
        medicine.name = name
        medicine.formulation = formulation
        cost_val = None
        if cost is not None and str(cost).strip() != '':
            cost_val = float(cost)
            
        medicine.cost = cost_val
        medicine.save()
        
        # Sync all camp wise stock records
        CampWiseStock.objects.filter(medicine=medicine).update(unit_cost=cost_val)
        
        return Response({
            'status': 'success',
            'message': 'Medicine profile updated successfully'
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_update_camp_unit_cost(request):
    try:
        data = request.data
        camp_id = data.get('camp_id')
        uqid = data.get('uqid')
        unit_cost = data.get('unit_cost')
        
        if not camp_id or not uqid:
            return Response({'status': 'error', 'message': 'Required fields are missing.'}, status=400)
            
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        medicine = get_object_or_404(Medicine, uqid=uqid)
        
        # get_or_create allows setting unit cost even if stock hasn't been allocated yet
        # pyrefly: ignore [missing-attribute]
        camp_stock, created = CampWiseStock.objects.get_or_create(camp=camp, medicine=medicine)
        
        val = None
        if unit_cost is not None and str(unit_cost).strip() != '':
            val = float(unit_cost)
            
        medicine.cost = val
        medicine.save()
        
        # Sync all camp wise stock records for this medicine (including this camp)
        CampWiseStock.objects.filter(medicine=medicine).update(unit_cost=val)
        
        return Response({
            'status': 'success',
            'message': 'Camp-specific unit cost updated successfully'
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['POST'])
@transaction.atomic
def api_update_camp_alternate_name(request):
    try:
        data = request.data
        camp_id = data.get('camp_id')
        uqid = data.get('uqid')
        alternate_name = data.get('alternate_name')
        
        if not camp_id or not uqid:
            return Response({'status': 'error', 'message': 'Required fields are missing.'}, status=400)
            
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        medicine = get_object_or_404(Medicine, uqid=uqid)
        
        # pyrefly: ignore [missing-attribute]
        camp_stock, created = CampWiseStock.objects.get_or_create(
            camp=camp, 
            medicine=medicine,
            defaults={'allocated_stock': 0, 'used_stock': 0}
        )
        
        camp_stock.alternate_name = alternate_name
        camp_stock.save()
        
        return Response({
            'status': 'success',
            'message': 'Camp-specific alternate name updated successfully'
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
        
        cost = data.get('cost')
        cost_val = None
        if cost is not None and str(cost).strip() != '':
            try:
                cost_val = float(cost)
            except ValueError:
                pass

        # pyrefly: ignore [missing-attribute]
        medicine = Medicine.objects.create(
            uqid=new_uqid,
            name=name,
            formulation=formulation,
            stock=stock,
            cost=cost_val
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
        
        # Aggregate duplicate medicine entries under the same camp session
        existing_item = None
        for item in history[camp_key]['items']:
            if item['medicine'] == issue['medicine_name']:
                existing_item = item
                break
        
        if existing_item:
            existing_item['qty'] += issue['qty']
        else:
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
        bp = (getattr(v, 'blood_pressure', '') or '').strip()
        sugar = (getattr(v, 'rbs', '') or '').strip()
        hb = (getattr(v, 'haemoglobin', '') or '').strip()
        
        has_data = any(val not in ["NA", "-", "", None] for val in [bp, sugar, hb])
        
        if has_data:
            display_date = 'N/A'
            if v.camp and v.camp.date:
                display_date = v.camp.date.strftime('%d/%m/%Y')
            elif hasattr(v, 'date') and v.date:
                display_date = v.date.strftime('%d/%m/%Y')

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
    # pyrefly: ignore [missing-attribute]
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
        
        # Check if patient is registered; if not, auto-create a skeleton patient record
        try:
            p_id_int = int(patient_id)
        except:
            p_id_int = 0
        # pyrefly: ignore [missing-attribute]
        if not Patient.objects.filter(patient_id=p_id_int).exists():
            # pyrefly: ignore [missing-attribute]
            Patient.objects.create(
                patient_id=p_id_int,
                patient_name=data.get('patient_name') or f"Patient {p_id_int}",
                patient_age=int(data.get('patient_age')) if data.get('patient_age') else None,
                registered_date=camp.date,
                camp_session=camp.number
            )
            
        aggregated_issues = {}
        for item in med_issues:
            med_id = item.get('med_id')
            qty = int(item.get('qty', 0))
            if not med_id or qty <= 0:
                continue
            
            try:
                med_key = int(med_id)
            except ValueError:
                med_key = med_id
                
            if med_key in aggregated_issues:
                aggregated_issues[med_key]['qty'] += qty
            else:
                aggregated_issues[med_key] = {
                    'med_id': med_id,
                    'qty': qty,
                    'formulation': item.get('formulation'),
                    'strength': item.get('strength'),
                    'days': int(item.get('days') or 0)
                }
        
        for item in aggregated_issues.values():
            med_id = item['med_id']
            qty = item['qty']
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
            PatientMedicineIssue.objects.create(
                patient_id=patient_id,
                camp=camp,
                medicine=medicine,
                qty=qty,
                formulation=item.get('formulation'),
                strength=item.get('strength'),
                days=item.get('days')
            )

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

        # Check if patient is registered; if not, auto-create a skeleton patient record
        p_id_int = safe_int(patient_id)
        # pyrefly: ignore [missing-attribute]
        if not Patient.objects.filter(patient_id=p_id_int).exists():
            # pyrefly: ignore [missing-attribute]
            Patient.objects.create(
                patient_id=p_id_int,
                patient_name=data.get('patient_name') or f"Patient {p_id_int}",
                patient_age=safe_int(data.get('patient_age')) or None,
                registered_date=camp.date,
                camp_session=camp.number
            )

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
        aggregated_med_issues = {}
        
        for item in med_issues:
            med_id = item.get('msNo')
            qty = safe_int(item.get('quantity'))
            if not med_id or qty <= 0:
                continue
            
            try:
                med_key = int(med_id)
            except ValueError:
                med_key = med_id
                
            if med_key in aggregated_med_issues:
                aggregated_med_issues[med_key]['quantity'] += qty
            else:
                aggregated_med_issues[med_key] = {
                    'msNo': med_id,
                    'quantity': qty,
                    'formulation': item.get('formulation'),
                    'strength': item.get('strength'),
                    'days': safe_int(item.get('days')),
                    'morning': safe_int(item.get('morning')),
                    'afternoon': safe_int(item.get('afternoon')),
                    'night': safe_int(item.get('night')),
                }
        
        for med_key, item in aggregated_med_issues.items():
            med_id = item['msNo']
            qty = item['quantity']
            
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
                    days=item.get('days'),
                    morning=item.get('morning'),
                    afternoon=item.get('afternoon'),
                    night=item.get('night')
                )

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
        # pyrefly: ignore [missing-attribute]
        medicines = PatientMedicineIssue.objects.filter(vitals_record=vitals)
        if not medicines.exists():
            # pyrefly: ignore [missing-attribute]
            medicines = PatientMedicineIssue.objects.filter(patient_id=vitals.patient_id, camp=vitals.camp)
            
        serializer_meds = PatientMedicineIssueSerializer(medicines, many=True)
        
        # Get tests: Same logic for tests
        # pyrefly: ignore [missing-attribute]
        tests = TestIssue.objects.filter(vitals_record=vitals)
        if not tests.exists():
             # pyrefly: ignore [missing-attribute]
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
        # pyrefly: ignore [missing-attribute]
        v = PatientVitals.objects.filter(id=vitals_id).first()
        is_legacy = False
        
        if not v:
            # Try legacy Vitals table
            # pyrefly: ignore [missing-attribute]
            v = Vitals.objects.filter(id=vitals_id).first()
            is_legacy = True
            
        if not v:
            return Response({'status': 'error', 'message': f"Visit ID {vitals_id} not found in any record table."}, status=404)

        camp = v.camp
        
        # 1. Revert medicine stock and delete issues
        # (Only PatientVitals have linked issues in the new system, but we check anyway)
        # pyrefly: ignore [missing-attribute]
        issues = PatientMedicineIssue.objects.filter(vitals_record_id=v.id) if not is_legacy else []
        for issue in issues:
            issue.delete()
            
        # 2. Delete test issues
        if not is_legacy:
            # pyrefly: ignore [missing-attribute]
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
        
        # Aggregate duplicates in new_med_data payload
        aggregated_new_meds = {}
        for item in new_med_data:
            med_id_val = item.get('msNo') or item.get('medicine')
            qty = safe_int(item.get('qty') or item.get('quantity'))
            if not med_id_val or qty <= 0:
                continue
                
            try:
                med_key = int(med_id_val)
            except ValueError:
                med_key = med_id_val
                
            if med_key in aggregated_new_meds:
                aggregated_new_meds[med_key]['qty'] += qty
            else:
                aggregated_new_meds[med_key] = {
                    'msNo': item.get('msNo'),
                    'medicine': item.get('medicine'),
                    'qty': qty,
                    'formulation': item.get('formulation'),
                    'strength': item.get('strength'),
                    'days': safe_int(item.get('days')),
                    'morning': safe_int(item.get('morning')),
                    'afternoon': safe_int(item.get('afternoon')),
                    'night': safe_int(item.get('night')),
                }
        
        # pyrefly: ignore [missing-attribute]
        existing_issues = {issue.id: issue for issue in PatientMedicineIssue.objects.filter(vitals_record=v)}
        kept_ids = []
        
        for med_key, item in aggregated_new_meds.items():
            med_id_val = item.get('msNo') or item.get('medicine')
            qty = item.get('qty')
            
            # Find medicine
            medicine = None
            if str(med_id_val).isdigit():
                # pyrefly: ignore [missing-attribute]
                medicine = Medicine.objects.filter(uqid=int(med_id_val)).first()
            if not medicine:
                # pyrefly: ignore [missing-attribute]
                medicine = Medicine.objects.filter(name=med_id_val).first()
            if not medicine:
                continue
            
            # Match with existing
            match = None
            for eid, eissue in existing_issues.items():
                if eid not in kept_ids and eissue.medicine == medicine:
                    match = eissue
                    break
            
            if match:
                # Update existing
                match.qty = qty
                match.days = item.get('days')
                match.morning = item.get('morning')
                match.afternoon = item.get('afternoon')
                match.night = item.get('night')
                match.formulation = item.get('formulation')
                match.strength = item.get('strength')
                match.save()
                kept_ids.append(match.id)
            else:
                # New record
                # pyrefly: ignore [missing-attribute]
                PatientMedicineIssue.objects.create(
                    patient_id=v.patient_id,
                    camp=camp,
                    medicine=medicine,
                    qty=qty,
                    vitals_record=v,
                    formulation=item.get('formulation'),
                    strength=item.get('strength'),
                    days=item.get('days'),
                    morning=item.get('morning'),
                    afternoon=item.get('afternoon'),
                    night=item.get('night')
                )
        
        # Cleanup
        for eid, eissue in existing_issues.items():
            if eid not in kept_ids:
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
        pid = data.get('pid')
        is_new_flag = data.get('is_new', True)
        
        # Coerce is_new_flag to boolean if it's sent as string or other values
        if isinstance(is_new_flag, str):
            is_new_flag = is_new_flag.lower() in ['true', '1', 'yes']

        # pyrefly: ignore [missing-attribute]
        patient = Patient.objects.filter(patient_id=pid).first()
        
        camp_num = data.get('camp_session')
        camp_obj = None
        if camp_num:
            # pyrefly: ignore [missing-attribute]
            camp_obj = MedicalCamp.objects.filter(number=camp_num).first()
            
        if patient:
            # Updating existing (Old Patient) - preserve original registered_date
            patient.patient_name = data.get('name')
            patient.patient_gender = data.get('gender')
            patient.patient_addr = data.get('address')
            patient.patient_age = data.get('age')
            patient.contact_no = data.get('contact')
            if camp_num:
                patient.camp_session = camp_num
            patient.save()
        else:
            # Creating new (New Patient)
            reg_date = None
            if camp_obj:
                reg_date = camp_obj.date
            elif data.get('regdate'):
                reg_date = data.get('regdate')
                
            # pyrefly: ignore [missing-attribute]
            patient = Patient.objects.create(
                patient_id=pid,
                patient_name=data.get('name'),
                patient_gender=data.get('gender'),
                patient_addr=data.get('address'),
                patient_age=data.get('age'),
                contact_no=data.get('contact'),
                registered_date=reg_date,
                camp_session=camp_num
            )
            
        # Record this specific camp visit
        if camp_obj:
            from .models import PatientCampVisit
            # pyrefly: ignore [missing-attribute]
            PatientCampVisit.objects.update_or_create(
                patient=patient,
                camp=camp_obj,
                defaults={
                    'visit_date': camp_obj.date,
                    'is_new': is_new_flag
                }
            )
            
        patient.refresh_from_db()
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
    patient = Patient.objects.filter(patient_id=pid).first()
    if patient:
        # A patient is a skeleton record if they lack a contact number (which is required during registration)
        is_skeleton = not bool(patient.contact_no)
        return Response({
            'exists': True, 
            'is_skeleton': is_skeleton,
            'patient_name': patient.patient_name,
            'patient_gender': patient.patient_gender,
            'patient_age': patient.patient_age
        })
    return Response({'exists': False})

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
                'returned': s['returned'],
                'remaining': s['remaining'],
                'unit_cost': s.get('unit_cost'),
                'alternate_name': s.get('alternate_name'),
                'company_name': s.get('company_name'),
                'expiry_date': s.get('expiry_date')
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
        
        company_name = data.get('company_name')
        expiry_date = data.get('expiry_date')

        # pyrefly: ignore [missing-attribute]
        camp_stock, created = CampWiseStock.objects.get_or_create(
            camp=camp,
            medicine=medicine,
            defaults={'allocated_stock': 0, 'used_stock': 0}
        )
            
        medicine.stock -= qty
        medicine.save()
        camp_stock.allocated_stock += qty
        if company_name:
            camp_stock.company_name = company_name
        if expiry_date:
            camp_stock.expiry_date = expiry_date
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
        camp_stock.returned_stock += remaining
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
            cs.returned_stock += remaining
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
        
        if MedicalCamp.objects.filter(number=camp_number).exists():
            return Response({'status': 'error', 'message': f'Camp number {camp_number} already exists.'}, status=400)
        # pyrefly: ignore [missing-attribute]
        venue, _ = MedicalCampVenue.objects.get_or_create(name=venue_name)
        # pyrefly: ignore [missing-attribute]
        camp = MedicalCamp.objects.create(
            number=camp_number,
            venue=venue,
            date=camp_date
        )
        camp.refresh_from_db()
        
        # Populate CampWiseDoctor with all doctors set to active=True
        doctors = Doctor.objects.all()
        for doc in doctors:
            CampWiseDoctor.objects.get_or_create(camp=camp, doctor=doc, defaults={'is_active': True})
            
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
    from .models import PatientCampVisit
    # pyrefly: ignore [missing-attribute]
    visit_pids = PatientCampVisit.objects.filter(camp=camp).values_list('patient_id', flat=True)
    
    # Fallback to legacy field just in case
    # pyrefly: ignore [missing-attribute]
    registered_pids = Patient.objects.filter(camp_session=camp.number).values_list('patient_id', flat=True)
    
    all_pids = set(vitals_pids) | set(issue_pids) | set(test_pids) | set(visit_pids) | set(registered_pids)
    
    # Fetch all relevant patients at once
    # pyrefly: ignore [missing-attribute]
    patients = Patient.objects.filter(patient_id__in=all_pids)
    patient_serializer = PatientSerializer(patients, many=True)
    patient_map = {p['patient_id']: p for p in patient_serializer.data}
    patient_map_obj = {p.patient_id: p for p in patients}

    # Map patient visits to find out if they are new or old
    # pyrefly: ignore [missing-attribute]
    visit_status_map = {
        v.patient_id: v.is_new
        for v in PatientCampVisit.objects.filter(camp=camp)
    }

    result = []
    for pid in sorted(all_pids):
        # pyrefly: ignore [missing-attribute]
        issues = PatientMedicineIssue.objects.filter(patient_id=pid, camp=camp)
        
        # Group and sum medicine quantities to prevent duplicate rows in UI
        grouped_issues = {}
        for issue in issues:
            med_id = issue.medicine.uqid
            if med_id in grouped_issues:
                grouped_issues[med_id]['qty'] += issue.qty
                grouped_issues[med_id]['quantity'] += issue.qty
            else:
                grouped_issues[med_id] = {
                    'id': issue.id,
                    'patient_id': pid,
                    'camp': camp.id,
                    'medicine_id': med_id,
                    'medicine_name': issue.medicine.name,
                    'qty': issue.qty,
                    'quantity': issue.qty,
                    'formulation': issue.formulation,
                    'strength': issue.strength,
                    'days': issue.days
                }
        med_data = list(grouped_issues.values())
        
        # pyrefly: ignore [missing-attribute]
        test_issues = TestIssue.objects.filter(patient_id=pid, camp=camp)
        
        # Group and unique test issues to prevent duplicate rows in UI
        grouped_tests = {}
        for issue in test_issues:
            tid = issue.test.test_id
            if tid in grouped_tests:
                if issue.reports_issued:
                    grouped_tests[tid]['reports_issued'] = True
            else:
                grouped_tests[tid] = {
                    'id': issue.id,
                    'test_issue_id': issue.id,
                    'patient_id': pid,
                    'camp': camp.id,
                    'test': issue.test_id,
                    'test_id': tid,
                    'test_name': issue.test.name,
                    'reports_issued': issue.reports_issued,
                    'vitals_record': issue.vitals_record_id
                }
        test_data = list(grouped_tests.values())
        
        p_data = patient_map.get(pid, {})
        patient_obj = patient_map_obj.get(pid)
        
        # Determine is_new using PatientCampVisit first, falling back to registered_date comparison
        is_new_val = visit_status_map.get(pid)
        if is_new_val is None:
            if patient_obj and patient_obj.registered_date:
                if patient_obj.registered_date < camp.date:
                    is_new_val = False
                else:
                    is_new_val = True
            else:
                is_new_val = True
        
        result.append({
            'patient_id': pid,
            'patient_name': p_data.get('name', ''),
            'age': p_data.get('age', ''),
            'gender': p_data.get('gender', ''),
            'contact': p_data.get('contact', ''),
            'address': p_data.get('address', ''),
            'registered_date': p_data.get('registered_date', ''),
            'is_new': is_new_val,
            'medicines': med_data,
            'tests': test_data,
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
            # pyrefly: ignore [missing-attribute]
            session = ScanSession.objects.get(session_id=session_uuid)
            session.ocr_status = 'error'
            session.save()
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
            'id': dr['id'],
            'dr_id': str(dr['id']),
            'dr_name': dr['name'],
            'specialization': dr['specialization'] or '',
            'is_active': dr['is_active']
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
        
        # Add the new doctor to all existing camps as active
        camps = MedicalCamp.objects.all()
        for camp in camps:
            CampWiseDoctor.objects.get_or_create(camp=camp, doctor=doctor, defaults={'is_active': True})
            
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

@api_view(['POST'])
def api_toggle_doctor_status(request, doctor_id):
    try:
        doctor = get_object_or_404(Doctor, id=doctor_id)
        doctor.is_active = not doctor.is_active
        doctor.save()
        return Response({
            'status': 'success',
            'message': f'Doctor marked as {"Active" if doctor.is_active else "Inactive"}',
            'is_active': doctor.is_active
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@api_view(['GET'])
def api_get_camp_doctors(request, camp_id):
    camp = MedicalCamp.objects.filter(number=camp_id).first()
    if not camp:
        camp = MedicalCamp.objects.filter(id=camp_id).first()
    if not camp:
        return Response({'status': 'error', 'message': 'Camp not found'}, status=404)
    
    doctors = Doctor.objects.all().order_by('id')
    camp_wise_docs = CampWiseDoctor.objects.filter(camp=camp)
    camp_wise_map = {cwd.doctor_id: cwd.is_active for cwd in camp_wise_docs}
    
    data = []
    for dr in doctors:
        is_active = camp_wise_map.get(dr.id, False)
        data.append({
            'id': dr.id,
            'dr_id': str(dr.id),
            'dr_name': dr.name,
            'specialization': dr.specialization or '',
            'is_active': is_active
        })
    return Response(data)

@api_view(['POST'])
def api_toggle_camp_doctor_status(request):
    camp_id = request.data.get('camp_id')
    doctor_id = request.data.get('doctor_id')
    if not camp_id or not doctor_id:
        return Response({'status': 'error', 'message': 'camp_id and doctor_id are required'}, status=400)
    
    camp = MedicalCamp.objects.filter(number=camp_id).first()
    if not camp:
        camp = MedicalCamp.objects.filter(id=camp_id).first()
    if not camp:
        return Response({'status': 'error', 'message': 'Camp not found'}, status=404)
        
    doctor = get_object_or_404(Doctor, id=doctor_id)
    
    cwd_qs = CampWiseDoctor.objects.filter(camp=camp, doctor=doctor)
    if cwd_qs.exists():
        # If record exists, the doctor is currently active.
        # Toggling makes them inactive, so we delete/remove the record from the table.
        cwd_qs.delete()
        is_active = False
    else:
        # If record does not exist, the doctor is currently inactive (default).
        # Toggling makes them active, so we create/keep the record in the table.
        CampWiseDoctor.objects.create(camp=camp, doctor=doctor, is_active=True)
        is_active = True
    
    return Response({
        'status': 'success',
        'message': f'Doctor marked as {"Active" if is_active else "Inactive"} for this camp',
        'is_active': is_active
    })

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
    from .models import ManualPatientRecord
    
    # Try to find by ID first, then by number as fallback
    camp = MedicalCamp.objects.filter(id=camp_id).first()
    if not camp:
        camp = MedicalCamp.objects.filter(number=camp_id).first()
    
    if not camp:
        return Response({'status': 'error', 'message': 'Camp not found'}, status=404)
    
    # pyrefly: ignore [missing-attribute]
    vitals = PatientVitals.objects.filter(camp=camp.number).order_by('dr_name')
    
    doctors_map = {}
    # Track which patient names are already counted per doctor to avoid double-counting
    seen_patients = {}
    
    for v in vitals:
        dr_key = v.dr_name or "Unknown Doctor"
        if dr_key not in doctors_map:
            doctors_map[dr_key] = {
                'dr_id': v.dr_id,
                'patients': []
            }
            seen_patients[dr_key] = set()
            
        # pyrefly: ignore [missing-attribute]
        meds = PatientMedicineIssue.objects.filter(patient_id=v.patient_id, camp=camp.number).values_list('medicine__name', flat=True)
        # pyrefly: ignore [missing-attribute]
        tests = TestIssue.objects.filter(patient_id=v.patient_id, camp=camp.number).values_list('test__name', flat=True)
        # pyrefly: ignore [missing-attribute]
        p_obj = Patient.objects.filter(patient_id=v.patient_id).first()
        p_name = p_obj.patient_name if p_obj else f"Patient {v.patient_id}"

        if p_name not in seen_patients[dr_key]:
            seen_patients[dr_key].add(p_name)
            doctors_map[dr_key]['patients'].append({
                'id': v.id,
                'patient_id': v.patient_id,
                'patient_name': p_name,
                'source': 'Logged Vitals',
                'medications': list(meds),
                'tests': list(tests)
            })

    # Fetch manually entered records
    manual_records = ManualPatientRecord.objects.filter(camp=camp)
    for mr in manual_records:
        dr_key = mr.doctor_name or (mr.doctor.name if mr.doctor else "Unknown Doctor")
        if dr_key not in doctors_map:
            doctors_map[dr_key] = {
                'dr_id': str(mr.doctor.id) if mr.doctor else None,
                'patients': []
            }
            seen_patients[dr_key] = set()
            
        p_name = mr.patient_name
        if p_name not in seen_patients[dr_key]:
            seen_patients[dr_key].add(p_name)
            
            # Fetch meds/tests for this patient if they exist in standard tables
            try:
                p_id_int = int(mr.patient_id_string)
                meds = PatientMedicineIssue.objects.filter(patient_id=p_id_int, camp=camp.number).values_list('medicine__name', flat=True)
                tests = TestIssue.objects.filter(patient_id=p_id_int, camp=camp.number).values_list('test__name', flat=True)
            except ValueError:
                meds = []
                tests = []
                
            doctors_map[dr_key]['patients'].append({
                'patient_id': mr.patient_id_string,
                'patient_name': p_name,
                'source': 'Manually Added',
                'medications': list(meds),
                'tests': list(tests)
            })
    
    data = {
        'camp_number': camp.number,
        'venue': camp.venue.name if camp.venue else "N/A",
        'doctors': []
    }
    
    for dr_name, info in doctors_map.items():
        data['doctors'].append({
            'dr_id': info['dr_id'],
            'dr_name': dr_name,
            'patients': info['patients']
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

        # Try to find by number first, then by ID as fallback
        camp = MedicalCamp.objects.filter(number=camp_id).first()
        if not camp:
            camp = MedicalCamp.objects.filter(id=camp_id).first()
            
        if not camp:
            return Response({'status': 'error', 'message': 'Camp not found'}, status=404)
        
        # 1. Get IDs from Vitals
        vitals_ids = PatientVitals.objects.filter(camp=camp).values_list('patient_id', flat=True)

        # 2. Get IDs from Medicine Issue
        medicine_ids = PatientMedicineIssue.objects.filter(camp=camp).values_list('patient_id', flat=True)

        # 3. Get IDs from Test Issue
        test_ids = TestIssue.objects.filter(camp=camp).values_list('patient_id', flat=True)

        # Get manually entered patients
        from .models import ManualPatientRecord
        manual_records = ManualPatientRecord.objects.filter(camp=camp)
        manual_patient_ids = []
        for mr in manual_records:
            try:
                manual_patient_ids.append(int(mr.patient_id_string))
            except ValueError:
                pass

        # 4. Combine them and remove duplicates (set)
        # This will find everyone who did ANYTHING at the camp
        attended_patient_ids = set(list(vitals_ids) + list(medicine_ids) + list(test_ids) + manual_patient_ids)

        # Check if we have registered camp visits in the PatientCampVisit model
        from .models import PatientCampVisit
        # pyrefly: ignore [missing-attribute]
        visits = PatientCampVisit.objects.filter(camp=camp)
        
        if visits.exists():
            total_patients = visits.count()
            # pyrefly: ignore [missing-attribute]
            new_patients = visits.filter(is_new=True).count()
            # pyrefly: ignore [missing-attribute]
            old_patients = visits.filter(is_new=False).count()
        else:
            # Fallback legacy logic based on active camp logs
            total_patients = len(attended_patient_ids)
            # pyrefly: ignore [missing-attribute]
            new_patients = Patient.objects.filter(patient_id__in=attended_patient_ids, camp_session=camp.number).count()
            old_patients = total_patients - new_patients

        # 4. Get Doctors who attended (Unique by dr_id)
        doctors_query = PatientVitals.objects.filter(camp=camp).values('dr_id', 'dr_name').distinct()
        
        unique_doctors = {}
        for d in doctors_query:
            if d['dr_id']:
                unique_doctors[d['dr_id']] = d['dr_name'] or "Unknown Doctor"
                
        # Merge manual doctors
        for mr in manual_records:
            dr_id = mr.doctor.id if mr.doctor else None
            dr_name = mr.doctor_name or (mr.doctor.name if mr.doctor else "Unknown Doctor")
            if dr_id:
                unique_doctors[dr_id] = dr_name
            elif dr_name:
                unique_doctors[f"manual_{dr_name}"] = dr_name
        
        doctor_names = list(unique_doctors.values())
        total_doctors = len(unique_doctors)

        stock_data=CampWiseStock.objects.filter(camp=camp)

        total_allocated = sum(s.allocated_stock for s in stock_data)

        total_used=sum(s.used_stock for s in stock_data)

        remaining_stock=max(0, total_allocated-total_used)

        total_cost = sum(s.used_stock * float(s.unit_cost if s.unit_cost is not None else (s.medicine.cost or 0)) for s in stock_data)

        total_tests= TestIssue.objects.filter(camp=camp).count()
        total_reports_issued = TestIssue.objects.filter(camp=camp, reports_issued=True).count()

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
                "total_cost": total_cost,
            },
            "tests":{
                "total_issued":total_tests,
                "reports_issued":total_reports_issued,
            },
            
            
        }

        return Response(report_data)
        
    except MedicalCamp.DoesNotExist:
        return Response({"error": "Camp not found"}, status=404)

@api_view(['GET'])
def api_get_doctor_report(request, camp_id):
    try:
        from .models import ManualPatientRecord
        records = ManualPatientRecord.objects.filter(camp__id=camp_id)
        data = [{
            'id': r.id,
            'campId': r.camp.id,
            'doctorId': r.doctor.id if r.doctor else None,
            'doctorName': r.doctor_name,
            'patientId': r.patient_id_string,
            'patientName': r.patient_name
        } for r in records]
        return Response(data)
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@api_view(['POST'])
def api_save_doctor_report(request):
    try:
        from .models import ManualPatientRecord, MedicalCamp, Doctor
        camp_id = request.data.get('campId')
        record_id = request.data.get('id') # if editing
        doctor_id = request.data.get('doctorId')
        doctor_name = request.data.get('doctorName')
        patient_id_string = request.data.get('patientId')
        patient_name = request.data.get('patientName')
        
        camp = MedicalCamp.objects.get(id=camp_id)
        doctor = Doctor.objects.get(id=doctor_id) if doctor_id else None
        
        if record_id and not str(record_id).startswith('tmp_'): # If it's a real DB id
            record = ManualPatientRecord.objects.get(id=record_id)
            record.doctor = doctor
            record.doctor_name = doctor_name
            record.patient_id_string = patient_id_string
            record.patient_name = patient_name
            record.save()
        else:
            record = ManualPatientRecord.objects.create(
                camp=camp,
                doctor=doctor,
                doctor_name=doctor_name,
                patient_id_string=patient_id_string,
                patient_name=patient_name
            )
            
        return Response({
            'status': 'success', 
            'record': {
                'id': record.id,
                'campId': record.camp.id,
                'doctorId': record.doctor.id if record.doctor else None,
                'doctorName': record.doctor_name,
                'patientId': record.patient_id_string,
                'patientName': record.patient_name
            }
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@api_view(['DELETE'])
def api_delete_doctor_report(request, record_id):
    try:
        from .models import ManualPatientRecord
        ManualPatientRecord.objects.filter(id=record_id).delete()
        return Response({'status': 'success'})
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)

@api_view(['POST'])
@transaction.atomic
def api_edit_doctor_patient_assignment(request):
    try:
        from .models import ManualPatientRecord, PatientVitals, Patient, Doctor
        data = request.data
        is_manual = data.get('is_manual')
        record_id = data.get('record_id')
        patient_id = data.get('patient_id')
        patient_name = data.get('patient_name')
        doctor_id = data.get('doctor_id')
        doctor_name = data.get('doctor_name')
        
        if is_manual:
            record = get_object_or_404(ManualPatientRecord, id=record_id)
            if doctor_id:
                record.doctor = get_object_or_404(Doctor, id=doctor_id)
            else:
                record.doctor = None
            record.doctor_name = doctor_name or (record.doctor.name if record.doctor else '')
            record.patient_id_string = str(patient_id)
            record.patient_name = patient_name
            record.save()
        else:
            vitals = get_object_or_404(PatientVitals, id=record_id)
            vitals.patient_id = int(patient_id)
            vitals.dr_id = str(doctor_id) if doctor_id else ''
            vitals.dr_name = doctor_name or ''
            vitals.save()
            
            # Also update the patient's name in the Patient table if they edited it
            Patient.objects.filter(patient_id=vitals.patient_id).update(patient_name=patient_name)
            
        return Response({'status': 'success', 'message': 'Record updated successfully'})
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)




@api_view(['GET'])
def api_get_patients_with_tests(request):
    try:
        # pyrefly: ignore [missing-attribute]
        issues = TestIssue.objects.all().select_related('test', 'camp', 'camp__venue').order_by('-id')

        patient_ids = list(issues.values_list('patient_id', flat=True).distinct())

        patients = Patient.objects.filter(patient_id__in=patient_ids)

        patient_map = {p.patient_id: p for p in patients}

        groups = {}

        for issue in issues:
            key = (issue.patient_id, issue.camp_id)

            if key not in groups:
                patient = patient_map.get(issue.patient_id)
                groups[key] = {
                    'patient_id': issue.patient_id,
                    'patient_name': patient.patient_name if patient else "Unknown Patient",
                    'contact_no': patient.contact_no if patient else "N/A",
                    'camp_session': issue.camp_id,
                    'camp_venue': issue.camp.venue.name if issue.camp and issue.camp.venue else "Unknown Venue",
                    'tests': [],
                    'all_reports_issued': True
                }

            groups[key]['tests'].append({
                'test_issue_id': issue.id,
                'test_id': issue.test.test_id if issue.test else "N/A",
                'test_name': issue.test.name if issue.test else "N/A",
                'reports_issued': issue.reports_issued,
            })

            if not issue.reports_issued:
                groups[key]['all_reports_issued'] = False
                
        return Response(list(groups.values()))
        
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)


@api_view(['POST'])
def api_ocr_patient_list(request):
    try:
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'status': 'error', 'message': 'No session_id provided'}, status=400)
            
        session = ScanSession.objects.filter(session_id=session_id).first()
        if not session:
            return Response({'status': 'error', 'message': 'Invalid session_id'}, status=404)
            
        if not session.image:
            return Response({'status': 'error', 'message': 'No image uploaded in this session'}, status=400)
            
        patients, message = ocr_service.process_patient_list(session.image.path)
        
        # Enrich list with exists_in_db checks
        enriched_patients = []
        if isinstance(patients, list):
            for p in patients:
                pid = p.get('patient_id')
                exists = False
                existing_pat = None
                if pid:
                    try:
                        existing_pat = Patient.objects.filter(patient_id=int(pid)).first()
                        exists = bool(existing_pat)
                    except ValueError:
                        pass
                
                if exists and existing_pat:
                    db_reg_date = ""
                    if existing_pat.registered_date:
                        db_reg_date = str(existing_pat.registered_date)
                    enriched_patients.append({
                        'patient_id': existing_pat.patient_id,
                        'name': existing_pat.patient_name or p.get('name') or '',
                        'gender': existing_pat.patient_gender or p.get('gender') or '',
                        'age': existing_pat.patient_age or p.get('age') or '',
                        'address': existing_pat.patient_addr or p.get('address') or '',
                        'contact_no': existing_pat.contact_no or p.get('contact_no') or '',
                        'reg_date': db_reg_date,
                        'old_or_new': 'Old',
                        'exists_in_db': True
                    })
                else:
                    ocr_old_new = p.get('old_or_new') or 'New'
                    # Standardize value to capitalized "Old" or "New"
                    if isinstance(ocr_old_new, str):
                        ocr_old_new = 'Old' if 'old' in ocr_old_new.lower() else 'New'
                    enriched_patients.append({
                        'patient_id': pid,
                        'name': p.get('name') or '',
                        'gender': p.get('gender') or '',
                        'age': p.get('age') or '',
                        'address': p.get('address') or '',
                        'contact_no': p.get('contact_no') or '',
                        'reg_date': p.get('reg_date') or '',
                        'old_or_new': ocr_old_new,
                        'exists_in_db': False
                    })
                
        return Response({
            'status': 'success',
            'message': message,
            'patients': enriched_patients
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)


def normalize_date_to_django(date_str):
    if not date_str:
        return None
    
    date_str = date_str.strip()
    
    # 1. Handle DD/MM/YY or DD/MM/YYYY
    if '/' in date_str:
        try:
            parts = date_str.split('/')
            if len(parts) == 3:
                day, month, year = parts[0], parts[1], parts[2]
                if len(year) == 2:
                    year = "20" + year
                return f"{year.zfill(4)}-{month.zfill(2)}-{day.zfill(2)}"
        except:
            pass
            
    # 2. Handle DD-MM-YY or DD-MM-YYYY
    if '-' in date_str:
        parts = date_str.split('-')
        if len(parts) == 3:
            if len(parts[0]) == 4:
                return date_str
            try:
                day, month, year = parts[0], parts[1], parts[2]
                if len(year) == 2:
                    year = "20" + year
                return f"{year.zfill(4)}-{month.zfill(2)}-{day.zfill(2)}"
            except:
                pass
                
    return date_str


@api_view(['POST'])
@transaction.atomic
def api_bulk_add_patients(request):
    try:
        data = request.data
        patients = data.get('patients', [])
        camp_num = data.get('camp_number')
        default_camp_num = data.get('default_camp_number', 15)
        
        if not camp_num:
            return Response({'status': 'error', 'message': 'Target camp number is required'}, status=400)
            
        target_camp = get_object_or_404(MedicalCamp, number=int(camp_num))
        default_camp = MedicalCamp.objects.filter(number=int(default_camp_num)).first()
        
        created_count = 0
        updated_count = 0
        
        for p in patients:
            pid_val = p.get('patient_id')
            if not pid_val:
                continue
                
            pid = int(pid_val)
            name = p.get('name')
            gender = p.get('gender')
            age_val = p.get('age')
            try:
                age = int(round(float(age_val))) if age_val else None
            except (ValueError, TypeError):
                age = None
            address = p.get('address')
            contact_no = p.get('contact_no')
            reg_date_str = p.get('reg_date')
            
            # Parse reg_date if entered, else default based on camp dates
            reg_date = normalize_date_to_django(reg_date_str)
            
            # Determine if they are Old or New
            old_or_new_val = p.get('old_or_new') or 'New'
            is_new = 'old' not in old_or_new_val.lower()
            
            patient_camp_num = camp_num if is_new else default_camp_num
            
            if not reg_date:
                if is_new:
                    reg_date = target_camp.date
                else:
                    reg_date = default_camp.date if default_camp else target_camp.date
            
            # Check if patient exists
            patient_exists = Patient.objects.filter(patient_id=pid).exists()
            
            patient, created = Patient.objects.update_or_create(
                patient_id=pid,
                defaults={
                    'patient_name': name,
                    'patient_age': age,
                    'patient_gender': gender,
                    'contact_no': contact_no,
                    'patient_addr': address,
                    'registered_date': reg_date,
                    'camp_session': int(patient_camp_num)
                }
            )
            
            if created:
                created_count += 1
            else:
                updated_count += 1
                
            # Create a patient visit record for the current camp session
            PatientCampVisit.objects.update_or_create(
                patient=patient,
                camp=target_camp,
                defaults={
                    'visit_date': target_camp.date,
                    'is_new': (patient.registered_date == target_camp.date)
                }
            )
            
        return Response({
            'status': 'success',
            'created_count': created_count,
            'updated_count': updated_count,
            'message': f'Successfully processed patients: {created_count} created, {updated_count} updated.'
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=400)
        


        

