import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Activity, Save, CheckCircle2, User, Heart, HeartPulse,
  Droplets, Thermometer, Clock, Calendar, Hash, Weight,
  Ruler, Stethoscope, Pill, PlusCircle, Trash2, FileText,
  AlertCircle, X, Landmark, FlaskConical, TestTubes,
  Users, ChevronDown, ChevronUp, Search, ClipboardList,
  QrCode, ScanLine, ExternalLink, Image as ImageIcon, CheckCircle, Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const API_BASE = `http://${window.location.hostname}:8000/api`;

// Input field component for consistency - MOVED OUTSIDE to prevent re-mounting bug
const VitalInput = ({ icon: Icon, label, value, onChange, type = 'text', placeholder = '', iconColor = 'text-teal-500', required = false, colSpan = '', readOnly = false }) => (
  <div className={`space-y-2 ${colSpan}`}>
    <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
      {Icon && <Icon size={11} className={iconColor} strokeWidth={2.5} />}
      {label}
      {required && <span className="text-rose-400">*</span>}
    </label>
    <input
      type={type}
      required={required}
      readOnly={readOnly}
      className={`w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all shadow-sm ${readOnly ? 'bg-slate-50 cursor-not-allowed text-slate-500' : 'bg-white hover:border-slate-300'}`}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

const Vitals = () => {
  // Patient Vitals state
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [eNo, setENo] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [rbs, setRbs] = useState('');
  const [haemoglobin, setHaemoglobin] = useState('');
  const [lastFoodTime, setLastFoodTime] = useState('');
  const [drName, setDrName] = useState('');
  const [drId, setDrId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [selectedTests, setSelectedTests] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [camps, setCamps] = useState([]);
  const [labTests, setLabTests] = useState([]);

  // Medicine table state
  const [medicines, setMedicines] = useState([
    { msNo: '', medicine: '', formulation: '', strength: '', days: '', morning: '', afternoon: '', night: '', quantity: '' }
  ]);
  const [allMedicines, setAllMedicines] = useState([]); // Master list for auto-fill
  const [campStocks, setCampStocks] = useState({}); // Real-time stock for selected camp (Object)

  // UI state
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Camp Wise Patient List state
  const [listCamp, setListCamp] = useState('');
  const [campPatients, setCampPatients] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [expandedPatient, setExpandedPatient] = useState(null);

  // Mobile Scan state
  const [scanSessionId, setScanSessionId] = useState(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanStatus, setScanStatus] = useState(null); // { is_completed: bool, image_url: string }

  useEffect(() => {
    axios.get(`${API_BASE}/camps`).then(res => setCamps(res.data));
    axios.get(`${API_BASE}/medicines`).then(res => setAllMedicines(res.data));
    axios.get(`${API_BASE}/tests`).then(res => setLabTests(res.data));
  }, []);

  useEffect(() => {
    if (selectedCamp) {
      axios.get(`${API_BASE}/camp_stock/${selectedCamp}`).then(res => {
        setCampStocks(res.data);
      });
    } else {
      setCampStocks({});
    }
  }, [selectedCamp]);

  // Effect to auto-fill Doctor Name
  useEffect(() => {
    if (!drId) {
      setDrName('');
      return;
    }
    
    const timer = setTimeout(() => {
      axios.get(`${API_BASE}/doctor/${drId}`)
        .then(res => {
          if (res.data.status === 'success') {
            setDrName(res.data.name);
          }
        })
        .catch(err => {
          // Do not clear the doctor name on error so they can type it manually
          console.log("Doctor not found for auto-fill");
        });
    }, 800);
    
    return () => clearTimeout(timer);
  }, [drId]);

  // Mobile Scan Handlers
  const handleCreateScanSession = async () => {
    try {
      const res = await axios.post(`${API_BASE}/create_scan_session`);
      if (res.data.status === 'success') {
        setScanSessionId(res.data.session_id);
        setShowScanModal(true);
        setScanStatus({ is_completed: false });
        startPolling(res.data.session_id);
      }
    } catch (err) {
      alert("Failed to create scan session. Check console.");
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !scanSessionId) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
        await axios.post(`${API_BASE}/upload_scan/${scanSessionId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        // Polling will handle the state update
    } catch (err) {
        console.error("Upload failed", err);
        setError("Image upload failed. Please try again.");
    }
  };

  const startPolling = (sessionId) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/check_scan_status/${sessionId}`);
        if (res.data.status === 'success' && res.data.is_completed) {
          setScanStatus(prev => ({
            ...prev,
            is_completed: true,
            image_url: res.data.image_url,
            ocr_status: res.data.ocr_status,
            ocr_data: res.data.ocr_data,
            ocr_raw_text: res.data.ocr_raw_text
          }));
          
          // Stop polling if OCR is done or errored
          if (res.data.ocr_status === 'completed' || res.data.ocr_status === 'error') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2000);

    // Stop polling if user closes modal manually or component unmounts
    setTimeout(() => {
        const modalCheck = setInterval(() => {
            if (!document.getElementById('scan-modal')) {
                clearInterval(interval);
                clearInterval(modalCheck);
            }
        }, 500);
    }, 100);
  };

  const handleAutoFill = () => {
    if (!scanStatus.ocr_data) return;
    const d = scanStatus.ocr_data;
    
    // Helper to get value from flat OR nested structure
    const getV = (key, category) => {
        if (d[key] !== undefined) return d[key];
        if (category && d[category] && d[category][key] !== undefined) return d[category][key];
        return '';
    };

    setPatientId(getV('patient_id', 'demographics'));
    setENo(getV('entry_no', 'demographics'));
    setWeight(getV('weight', 'vitals'));
    setHeight(getV('height', 'vitals'));
    setBloodPressure(getV('bp', 'vitals'));
    setPulse(getV('pulse', 'vitals'));
    setRbs(getV('rbs', 'vitals'));
    setHaemoglobin(getV('hemo', 'vitals'));
    setDrId(getV('doctor_id', 'clinical'));
    setDrName(getV('doctor_name', 'clinical'));
    setDiagnosis(getV('diagnosis', 'clinical'));
    
    // Lab Tests (ensure IDs are numbers for the checkboxes to work)
    const tests = d.lab_tests || (d.clinical && d.clinical.lab_tests) || [];
    if (tests.length > 0) {
        setSelectedTests(tests.map(id => parseInt(id)).filter(id => !isNaN(id)));
    }
    
    // Medicines with Inventory Lookup
    const meds = d.medicines || (d.clinical && d.clinical.medicines) || [];
    if (meds.length > 0) {
        setMedicines(meds.map(m => {
            let medData = {
                msNo: m.ms_no || '', 
                medicine: m.medicine_name || '', 
                formulation: m.formulation || m.strength || '', // Support migration
                strength: m.strength_value || m.strength || '', 
                days: m.days || '', 
                morning: m.morning || '', 
                afternoon: m.afternoon || '', 
                night: m.night || '', 
                quantity: m.quantity || '' 
            };

            // If we have an ID but no name, look it up in inventory
            if (medData.msNo && !medData.medicine) {
                const found = allMedicines.find(am => am.uqid === parseInt(medData.msNo));
                if (found) {
                    medData.medicine = found.name;
                    medData.formulation = found.formulation || '';
                }
            }
            return medData;
        }));
    }
    
    setShowScanModal(false);
  };

  const addMedicineRow = () => {
    setMedicines(prev => [
      ...prev,
      { msNo: '', medicine: '', formulation: '', strength: '', days: '', morning: '', afternoon: '', night: '', quantity: '' }
    ]);
  };

  const removeMedicineRow = (index) => {
    if (medicines.length <= 1) return;
    setMedicines(prev => prev.filter((_, i) => i !== index));
  };

  const updateMedicine = (index, field, value) => {
    setMedicines(prev => prev.map((m, i) => {
      if (i !== index) return m;

      let updatedMed = { ...m, [field]: value };

      // Auto-fill logic when M.S.No (UQID) is entered
      if (field === 'msNo' && value !== '') {
        const foundMed = allMedicines.find(am => am.uqid === parseInt(value));
        if (foundMed) {
          updatedMed.medicine = foundMed.name;
          updatedMed.formulation = foundMed.formulation || ''; // Use formulation from inventory
        }
      }

      return updatedMed;
    }));
  };

  // Auto-calculate quantity based on days × (morning + afternoon + night)
  const calcQuantity = (med) => {
    const days = parseInt(med.days) || 0;
    const morning = parseInt(med.morning) || 0;
    const afternoon = parseInt(med.afternoon) || 0;
    const night = parseInt(med.night) || 0;
    return days > 0 ? days * (morning + afternoon + night) : '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientId) {
      setError('Patient ID is required');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!selectedCamp) {
      setError('Please select an active medical camp session');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/save_vitals`, {
        patient_id: patientId,
        medical_camp: selectedCamp,
        date,
        time,
        e_no: eNo,
        weight,
        height,
        blood_pressure: bloodPressure,
        pulse,
        rbs,
        haemoglobin,
        last_food_time: lastFoodTime,
        dr_name: drName,
        dr_id: drId,
        diagnosis,
        selected_tests: selectedTests,
        medicines: medicines.filter(m => m.medicine.trim() !== '').map(m => ({
          ...m,
          quantity: calcQuantity(m) || m.quantity
        }))
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      // Reset form
      setPatientId('');
      setENo('');
      setWeight('');
      setHeight('');
      setBloodPressure('');
      setPulse('');
      setRbs('');
      setHaemoglobin('');
      setLastFoodTime('');
      setDrName('');
      setDrId('');
      setDiagnosis('');
      setSelectedTests([]);
      setMedicines([{ msNo: '', medicine: '', strength: '', days: '', morning: '', afternoon: '', night: '', quantity: '' }]);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving vitals. Please try again.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 space-y-8">
      {/* Header with Scan Button */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse size={14} className="text-teal-500" />
            <p className="text-teal-600 text-[10px] font-extrabold uppercase tracking-[0.25em]">Clinical Assessment</p>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200">
              <Activity className="text-teal-600" size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Patient Vitals</h3>
          </div>
          <p className="text-slate-400 text-sm font-bold ml-[52px]">Comprehensive health baseline and diagnostics</p>
        </div>

        <div className="flex flex-col items-end gap-3">
            {/* Success / Error badges */}
            <div className="flex gap-3">
            {success && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-3 rounded-xl border border-emerald-200 shadow-sm animate-bounce">
                <CheckCircle2 size={18} strokeWidth={3} />
                <span className="text-xs font-black uppercase tracking-widest">Record Saved</span>
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-5 py-3 rounded-xl border border-rose-200 shadow-sm">
                <AlertCircle size={18} strokeWidth={3} />
                <span className="text-xs font-black uppercase tracking-widest">{error}</span>
                </div>
            )}
            </div>

            <button 
                onClick={handleCreateScanSession}
                className="flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-700 px-6 py-4 rounded-2xl border border-slate-200 hover:border-teal-200 transition-all shadow-sm font-black text-xs uppercase tracking-widest active:scale-95"
            >
                <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
                    <ScanLine size={18} strokeWidth={2.5} />
                </div>
                Scan Patient Report
            </button>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6 px-4">

        {/* ═══════════ PATIENT VITALS SECTION ═══════════ */}
        <div className="glass-panel-light p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400" />

          {/* Section title */}
          <div className="flex items-center gap-2 mb-6">
            <div className="p-1.5 bg-teal-50 rounded-lg border border-teal-100">
              <Stethoscope size={16} className="text-teal-600" strokeWidth={2.5} />
            </div>
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">Patient Information & Vitals</h4>
          </div>

          {/* New Row 0: Camp Selection */}
          <div className="mb-8 p-6 bg-slate-50/50 border border-slate-100 rounded-2xl">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
              <Landmark size={14} className="text-teal-500" /> Active Medical Camp Session
            </label>
            <select
              required
              className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer"
              value={selectedCamp}
              onChange={e => setSelectedCamp(e.target.value)}
            >
              <option value="">Choose the current medical camp session...</option>
              {camps.map(camp => (
                <option key={camp.id} value={camp.id}>
                  {camp.venue} • Camp {camp.number} ({camp.date})
                </option>
              ))}
            </select>
          </div>

          {/* Row 1: Patient ID, Date, Time, E.No */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
            <VitalInput icon={User} label="Patient ID" value={patientId} onChange={setPatientId} placeholder="Enter ID" required iconColor="text-blue-500" />
            <VitalInput icon={Calendar} label="Date" value={date} onChange={setDate} type="date" iconColor="text-indigo-500" />
            <VitalInput icon={Clock} label="Time" value={time} onChange={setTime} type="time" iconColor="text-violet-500" />
            <VitalInput icon={Hash} label="E.No" value={eNo} onChange={setENo} placeholder="Entry No." iconColor="text-cyan-500" />
          </div>

          {/* Row 2: WT, HT, B.P, PULSE */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
            <VitalInput icon={Weight} label="WT (kg)" value={weight} onChange={setWeight} placeholder="Weight" iconColor="text-amber-500" />
            <VitalInput icon={Ruler} label="HT (cm)" value={height} onChange={setHeight} placeholder="Height" iconColor="text-orange-500" />
            <VitalInput icon={HeartPulse} label="B.P" value={bloodPressure} onChange={setBloodPressure} placeholder="e.g. 120/80" iconColor="text-rose-500" />
            <VitalInput icon={Activity} label="Pulse" value={pulse} onChange={setPulse} placeholder="BPM" iconColor="text-pink-500" />
          </div>

          {/* Row 3: RBS, Hemo */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-5 mb-5">
            <VitalInput icon={Droplets} label="RBS" value={rbs} onChange={setRbs} placeholder="Blood Sugar" iconColor="text-amber-500" />
            <VitalInput icon={Thermometer} label="Hemo" value={haemoglobin} onChange={setHaemoglobin} placeholder="Haemoglobin" iconColor="text-rose-500" />
          </div>

          {/* Row 4: Dr Name, Dr ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <VitalInput icon={Hash} label="Dr. ID" value={drId} onChange={setDrId} placeholder="Enter ID to search" iconColor="text-indigo-500" />
            <VitalInput icon={Stethoscope} label="Dr. Name" value={drName} onChange={setDrName} placeholder="Auto-filled or type manually" iconColor="text-blue-500" />
          </div>

          {/* Row 5: Diagnosis & Tests */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <FileText size={11} className="text-teal-500" strokeWidth={2.5} />
              Diagnosis
            </label>
            <textarea
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all shadow-sm hover:border-slate-300 min-h-[80px] resize-y"
              placeholder="Enter diagnosis details..."
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
            />
          </div>

          {/* ═══════════ LAB TESTS SECTION ═══════════ */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                <FlaskConical size={11} className="text-purple-500" strokeWidth={2.5} />
                Lab Tests
              </label>
              {selectedTests.length > 0 && (
                <span className="px-2.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-black rounded-full border border-purple-100">
                  {selectedTests.length} selected
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {labTests.map(test => {
                const isChecked = selectedTests.includes(test.id);
                return (
                  <label
                    key={test.id}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all select-none group ${
                      isChecked
                        ? 'bg-purple-50 border-purple-300 shadow-sm shadow-purple-100'
                        : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-purple-50/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedTests(prev =>
                          prev.includes(test.id)
                            ? prev.filter(id => id !== test.id)
                            : [...prev, test.id]
                        );
                      }}
                    />
                    {/* Custom checkbox */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isChecked
                        ? 'bg-purple-600 border-purple-600'
                        : 'border-slate-300 group-hover:border-purple-400'
                    }`}>
                      {isChecked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Test ID badge + name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${
                        isChecked
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {test.id}
                      </span>
                      <span className={`text-xs font-bold truncate ${
                        isChecked ? 'text-purple-700' : 'text-slate-600'
                      }`}>
                        {test.name}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════ ISSUE MEDICINE SECTION ═══════════ */}
        <div className="glass-panel-light p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-green-400 to-teal-400" />

          {/* Section title + Add button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <Pill size={16} className="text-emerald-600" strokeWidth={2.5} />
              </div>
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">Issue Medicine</h4>
              <span className="ml-2 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100">
                {medicines.length} {medicines.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              type="button"
              onClick={addMedicineRow}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-100 active:scale-95"
            >
              <PlusCircle size={16} strokeWidth={2.5} />
              Add Medicine
            </button>
          </div>

          {/* Medicine Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-20 text-center">M.S.No</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] min-w-[200px]">Medicines</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-24 text-center">Formulation</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-24 text-center">Strength</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-20 text-center">Days</th>
                  <th className="px-4 py-4 text-[10px] font-black text-amber-500 uppercase tracking-[0.15em] w-20 text-center">Morning</th>
                  <th className="px-4 py-4 text-[10px] font-black text-blue-500 uppercase tracking-[0.15em] w-24 text-center">Afternoon</th>
                  <th className="px-4 py-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.15em] w-20 text-center">Night</th>
                  <th className="px-4 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em] w-24 text-center">Quantity</th>
                  <th className="px-4 py-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicines.map((med, index) => {
                  const autoQty = calcQuantity(med);
                  return (
                    <tr key={index} className="hover:bg-emerald-50/30 transition-all group">
                      {/* M.S.No */}
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          className="w-full bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 rounded-lg px-2 py-2.5 text-sm font-black text-teal-700 text-center placeholder:text-teal-300 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm"
                          placeholder="ID"
                          value={med.msNo}
                          onChange={e => updateMedicine(index, 'msNo', e.target.value)}
                        />
                      </td>

                      {/* Medicine Name */}
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          placeholder="Medicine name"
                          value={med.medicine}
                          onChange={e => updateMedicine(index, 'medicine', e.target.value)}
                        />
                      </td>

                      {/* Formulation */}
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 text-center placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          placeholder="e.g. Tab"
                          value={med.formulation}
                          onChange={e => updateMedicine(index, 'formulation', e.target.value)}
                        />
                      </td>

                      {/* Strength */}
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 text-center placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          placeholder="mg/ml"
                          value={med.strength}
                          onChange={e => updateMedicine(index, 'strength', e.target.value)}
                        />
                      </td>

                      {/* Days */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 text-center placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          placeholder="0"
                          value={med.days}
                          onChange={e => updateMedicine(index, 'days', e.target.value)}
                        />
                      </td>

                      {/* Morning */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          className="w-full bg-amber-50/50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 text-center placeholder:text-amber-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                          placeholder="0"
                          value={med.morning}
                          onChange={e => updateMedicine(index, 'morning', e.target.value)}
                        />
                      </td>

                      {/* Afternoon */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          className="w-full bg-blue-50/50 border border-blue-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 text-center placeholder:text-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          placeholder="0"
                          value={med.afternoon}
                          onChange={e => updateMedicine(index, 'afternoon', e.target.value)}
                        />
                      </td>

                      {/* Night */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          className="w-full bg-indigo-50/50 border border-indigo-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 text-center placeholder:text-indigo-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                          placeholder="0"
                          value={med.night}
                          onChange={e => updateMedicine(index, 'night', e.target.value)}
                        />
                      </td>

                      {/* Quantity (auto-calculated) */}
                      <td className="px-3 py-3">
                        <div className={`w-full border rounded-lg px-3 py-2.5 text-sm font-black text-center min-h-[42px] flex flex-col items-center justify-center transition-all ${(() => {
                          const stockItem = campStocks[med.msNo];
                          const remaining = stockItem ? stockItem.remaining : null;
                          if (remaining !== null && autoQty > remaining) return 'bg-rose-50 border-rose-200 text-rose-700';
                          return 'bg-emerald-50 border-emerald-200 text-emerald-700';
                        })()
                          }`}>
                          {autoQty || (
                            <span className="text-emerald-300 font-bold">—</span>
                          )}
                          {(() => {
                            const stockItem = campStocks[med.msNo];
                            const remaining = stockItem ? stockItem.remaining : null;
                            if (remaining !== null && autoQty > remaining) {
                              return <span className="text-[8px] uppercase mt-1">Exceeds Stock ({remaining})</span>
                            }
                            return null;
                          })()}
                        </div>
                      </td>

                      {/* Delete */}
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => removeMedicineRow(index)}
                          disabled={medicines.length <= 1}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove row"
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick add hint */}
          <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-bold ml-1">
            <AlertCircle size={12} />
            <span>Quantity is auto-calculated as <span className="text-slate-500">Days × (Morning + Afternoon + Night)</span></span>
          </div>
        </div>

        {/* ═══════════ SUBMIT BUTTON ═══════════ */}
        <button
          type="submit"
          disabled={loading}
          className="w-full relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white h-16 rounded-2xl transition-all shadow-xl shadow-teal-200/50 group active:scale-[0.99]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <div className="relative flex items-center justify-center gap-3">
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={20} strokeWidth={2.5} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                <span className="text-sm font-black uppercase tracking-[0.2em]">Save Patient Record & Issue Medicines</span>
              </>
            )}
          </div>
        </button>
      </form>
      {/* Mobile Scan Modal */}
      {showScanModal && (
        <div id="scan-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
                        <QrCode size={24} />
                    </div>
                    <h4 className="font-black text-slate-800 tracking-tight">Scan Patient Report</h4>
                </div>
                <button 
                    onClick={() => setShowScanModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="p-8 flex flex-col items-center">
                {!scanStatus.is_completed ? (
                    <>
                        <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 mb-6 shadow-inner">
                            <QRCodeSVG 
                                value={`http://${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '192.168.0.32' : window.location.hostname}:5173/mobile-upload/${scanSessionId}`}
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </div>
                        <p className="text-center text-slate-800 font-bold mb-2">Scan with Admin Phone</p>
                        <p className="text-center text-slate-400 text-xs font-bold leading-relaxed max-w-[240px]">
                            Open the camera on your phone to scan this code and upload the report image.
                        </p>

                        {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-700 font-bold text-center leading-tight">
                                ⚠️ Localhost detected. For best results, access the laptop dashboard at:<br/>
                                <span className="text-amber-900 underline">http://192.168.0.32:5173/vitals</span>
                            </div>
                        )}
                        
                        <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-teal-600 bg-teal-50 px-4 py-2 rounded-full uppercase tracking-widest animate-pulse">
                            <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                            Waiting for upload...
                        </div>

                        {/* Divider */}
                        <div className="w-full flex items-center gap-4 my-8">
                            <div className="flex-1 h-px bg-slate-100" />
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">OR</span>
                            <div className="flex-1 h-px bg-slate-100" />
                        </div>

                        {/* Local Upload */}
                        <label className="w-full flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50/50 hover:bg-teal-50/30 hover:border-teal-200 transition-all cursor-pointer group">
                            <input 
                                type="file" 
                                className="sr-only" 
                                accept="image/*" 
                                onChange={handleFileUpload}
                            />
                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 group-hover:text-teal-600 transition-colors">
                                <ImageIcon size={28} strokeWidth={2.5} />
                            </div>
                            <div className="text-center">
                                <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1">Upload from Computer</p>
                                <p className="text-[10px] font-bold text-slate-400 tracking-wide">Choose report photo from your folder</p>
                            </div>
                        </label>
                    </>
                ) : (
                    <div className="w-full animate-in fade-in zoom-in duration-500">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 mb-6">
                            <CheckCircle size={20} strokeWidth={3} />
                            <span className="text-xs font-black uppercase tracking-widest">Report Received</span>
                        </div>
                        
                        {scanStatus.ocr_status === 'processing' && (
                            <div className="mb-6 p-6 bg-teal-50 border-2 border-teal-100 rounded-[24px] flex flex-col items-center gap-4 animate-pulse">
                                <div className="relative">
                                    <Loader2 className="animate-spin text-teal-600" size={32} strokeWidth={3} />
                                    <Activity className="absolute inset-0 m-auto text-teal-400 animate-pulse" size={12} />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-black text-teal-700 uppercase tracking-[0.2em] mb-1">Medical OCR AI is Processing</p>
                                    <p className="text-[10px] font-bold text-teal-600/60 uppercase tracking-widest">Digitizing handwritten medical vitals...</p>
                                </div>
                                <div className="w-full bg-teal-100/50 h-1 rounded-full overflow-hidden">
                                    <div className="bg-teal-500 h-full w-1/2 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                                </div>
                            </div>
                        )}

                        {scanStatus.ocr_status === 'completed' && (
                            <button 
                                onClick={handleAutoFill}
                                className="w-full mb-6 bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-teal-100 flex items-center justify-center gap-2 animate-bounce"
                            >
                                <PlusCircle size={18} />
                                Auto-Fill Patient Form
                            </button>
                        )}
                        
                        <div className="aspect-[4/5] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-inner group relative">
                            <img 
                                src={scanStatus.image_url} 
                                alt="Scanned Report" 
                                className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <a 
                                    href={scanStatus.image_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="bg-white text-slate-800 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"
                                >
                                    <ExternalLink size={14} /> View Full
                                </a>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                setScanStatus({ is_completed: false });
                                handleCreateScanSession();
                            }}
                            className="w-full mt-6 flex items-center justify-center gap-2 text-slate-400 hover:text-teal-600 font-black text-[10px] uppercase tracking-[0.2em] transition-all"
                        >
                            <ScanLine size={14} /> Scan Another Page
                        </button>
                    </div>
                )}
            </div>
            
            <div className="bg-slate-50 p-6 flex flex-col items-center border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-300 mb-1">
                    <ImageIcon size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Phase 1 Workflow Active</span>
                </div>
                <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">Images are stored in media/scanned_reports/</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vitals;
