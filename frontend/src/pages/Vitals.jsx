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
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [lastFetchedId, setLastFetchedId] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  });
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
    { msNo: '', medicine: '', formulation: '', strength: '', days: '', quantity: '' }
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
      // Synchronize session date with camp date
      const camp = camps.find(c => c.number === parseInt(selectedCamp));
      if (camp && camp.date) {
        if (camp.date.includes('/')) {
            setDate(camp.date); // Already in DD/MM/YYYY
        } else {
            const [y, m, d] = camp.date.split('-');
            setDate(`${d}/${m}/${y}`);
        }
      }
    } else {
      setCampStocks({});
    }
  }, [selectedCamp, camps]);

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

  // Effect to auto-fill Patient Name & Age from Patient ID
  useEffect(() => {
    if (!patientId) {
      setPatientName('');
      setPatientAge('');
      setLastFetchedId('');
      return;
    }

    // Clear fields if we are switching away from a previously fetched patient ID
    if (lastFetchedId && patientId !== lastFetchedId) {
      setPatientName('');
      setPatientAge('');
      setLastFetchedId('');
    }

    const timer = setTimeout(() => {
      axios.get(`${API_BASE}/check_patient_id/${patientId}`)
        .then(res => {
          if (res.data.exists) {
            setPatientName(res.data.patient_name || '');
            setPatientAge(res.data.patient_age || '');
            setLastFetchedId(patientId);
          }
        })
        .catch(err => {
          console.log("Patient not found for auto-fill");
        });
    }, 400); // 400ms debounce to avoid spamming requests while typing

    return () => clearTimeout(timer);
  }, [patientId, lastFetchedId]);

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

  const handleDateChange = (value) => {
    let val = value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
    if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5, 10);
    setDate(val);
  };

  const handleNativeDateChange = (e) => {
    const val = e.target.value; // YYYY-MM-DD
    if (val) {
        const [y, m, d] = val.split('-');
        setDate(`${d}/${m}/${y}`);
    }
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
    setPatientName(getV('patient_name', 'demographics') || getV('name', 'demographics'));
    setPatientAge(getV('age', 'demographics'));
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
                quantity: m.quantity || '' 
            };

            // If we have an ID but no name, look it up in inventory
            if (medData.msNo && !medData.medicine) {
                const found = allMedicines.find(am => am.uqid === parseInt(medData.msNo));
                if (found) {
                    const campStockItem = campStocks[medData.msNo];
                    medData.medicine = (campStockItem && campStockItem.alternate_name) ? campStockItem.alternate_name : found.name;
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
      { msNo: '', medicine: '', formulation: '', strength: '', days: '', quantity: '' }
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
          const campStockItem = campStocks[value];
          updatedMed.medicine = (campStockItem && campStockItem.alternate_name) ? campStockItem.alternate_name : foundMed.name;
          updatedMed.formulation = foundMed.formulation || ''; // Use formulation from inventory
        }
      }

      // Auto-fill logic when Medicine Name is selected from dropdown
      if (field === 'medicine' && value !== '') {
        // find by name or alternate_name
        const foundMed = allMedicines.find(am => am.name === value || (campStocks[am.uqid] && campStocks[am.uqid].alternate_name === value));
        if (foundMed) {
          updatedMed.msNo = String(foundMed.uqid);
          updatedMed.formulation = foundMed.formulation || '';
        }
      }

      return updatedMed;
    }));
  };

  // Group medicines by category for the dropdown
  const groupedMedicines = allMedicines.reduce((acc, med) => {
    const category = med.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(med);
    return acc;
  }, {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientId) {
      setError('Patient ID is required');
      return;
    }

    if (!selectedCamp) {
      setError('Please select an active medical camp session');
      return;
    }

    setLoading(true);
    try {
      let apiDate = date;
      if (date.includes('/')) {
        const [d, m, y] = date.split('/');
        apiDate = `${y}-${m}-${d}`;
      }

      await axios.post(`${API_BASE}/save_vitals`, {
        patient_id: patientId,
        patient_name: patientName,
        patient_age: patientAge,
        medical_camp: selectedCamp,
        date: apiDate,
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
          msNo: m.msNo,
          medicine: m.medicine,
          formulation: m.formulation,
          strength: m.strength,
          days: parseInt(m.days) || 0,
          quantity: parseInt(m.quantity) || 0
        }))
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      // Reset form
      setPatientId('');
      setPatientName('');
      setPatientAge('');
      setLastFetchedId('');
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
      setMedicines([{ msNo: '', medicine: '', formulation: '', strength: '', days: '', quantity: '' }]);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving vitals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 space-y-8">
      {/* Centered Error Modal */}
      {error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border border-slate-100 flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-5 shadow-inner">
              <AlertCircle size={32} strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight mb-2">Error Encountered</h3>
            <p className="text-sm font-bold text-slate-500 leading-relaxed mb-6">{error}</p>
            <button
              type="button"
              onClick={() => setError('')}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-200 active:scale-[0.98]"
            >
              Okay, Dismiss
            </button>
          </div>
        </div>
      )}

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

          {/* Row 1: Date, Patient ID, Patient Name, Patient Age */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
            <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                <Calendar size={11} className="text-indigo-500" strokeWidth={2.5} />
                Date (DD/MM/YYYY)
                </label>
                <div className="relative">
                    <input
                        type="text"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all shadow-sm bg-white hover:border-slate-300"
                        placeholder="DD/MM/YYYY"
                        value={date}
                        onChange={e => handleDateChange(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => document.getElementById('native-date-picker').showPicker()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-500 transition-colors"
                    >
                        <Calendar size={16} />
                    </button>
                    <input 
                        type="date"
                        id="native-date-picker"
                        className="absolute opacity-0 pointer-events-none right-0"
                        onChange={handleNativeDateChange}
                    />
                </div>
            </div>

            <div className={`space-y-2`}>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                <User size={11} className="text-blue-500" strokeWidth={2.5} />
                Patient ID
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                className={`w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all shadow-sm bg-white hover:border-slate-300`}
                placeholder="Enter ID"
                value={patientId}
                onChange={e => setPatientId(e.target.value)}
              />
            </div>

            <VitalInput icon={User} label="Patient Name" value={patientName} onChange={setPatientName} placeholder="Auto-filled" iconColor="text-blue-500" />
            <VitalInput icon={User} label="Age" value={patientAge} onChange={setPatientAge} placeholder="Age" iconColor="text-blue-500" />
          </div>

          {/* Row 2: Time, E.No, WT, HT */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
            <VitalInput icon={Clock} label="Time" value={time} onChange={setTime} type="time" iconColor="text-violet-500" />
            <VitalInput icon={Hash} label="E.No" value={eNo} onChange={setENo} placeholder="Entry No." iconColor="text-cyan-500" />
            <VitalInput icon={Weight} label="WT (kg)" value={weight} onChange={setWeight} placeholder="Weight" iconColor="text-amber-500" />
            <VitalInput icon={Ruler} label="HT (cm)" value={height} onChange={setHeight} placeholder="Height" iconColor="text-orange-500" />
          </div>

          {/* Row 3: B.P, PULSE, RBS, Hemo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
            <VitalInput icon={HeartPulse} label="B.P" value={bloodPressure} onChange={setBloodPressure} placeholder="e.g. 120/80" iconColor="text-rose-500" />
            <VitalInput icon={Activity} label="Pulse" value={pulse} onChange={setPulse} placeholder="BPM" iconColor="text-pink-500" />
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
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-[35%]">Medicines</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-[20%] text-center">Formulation</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-24 text-center">Strength</th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] w-20 text-center">Days</th>
                  <th className="px-4 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em] w-24 text-center">Quantity</th>
                  <th className="px-4 py-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicines.map((med, index) => {
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

                      {/* Medicine Name Dropdown */}
                      <td className="px-3 py-3">
                        <select
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                          value={med.medicine}
                          onChange={e => updateMedicine(index, 'medicine', e.target.value)}
                        >
                          <option value="">Select Medicine</option>
                          {Object.entries(groupedMedicines).map(([category, meds]) => (
                            <optgroup key={category} label={category}>
                              {meds.map(am => {
                                const campStockItem = campStocks[am.uqid];
                                const displayName = (campStockItem && campStockItem.alternate_name) ? campStockItem.alternate_name : am.name;
                                return (
                                  <option key={am.uqid} value={displayName}>
                                    {displayName} {am.formulation ? `(${am.formulation})` : ''}
                                  </option>
                                );
                              })}
                            </optgroup>
                          ))}
                        </select>
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
                          placeholder="Days"
                          value={med.days}
                          onChange={e => updateMedicine(index, 'days', e.target.value)}
                        />
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1 items-center">
                          <input
                            type="number"
                            min="0"
                            className={`w-full bg-white border rounded-lg px-3 py-2.5 text-sm font-bold text-slate-800 text-center placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all ${(() => {
                              const stockItem = campStocks[med.msNo];
                              const remaining = stockItem ? stockItem.remaining : null;
                              if (remaining !== null && med.quantity > remaining) return 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/50';
                              return 'border-slate-200';
                            })()}`}
                            placeholder="Qty"
                            value={med.quantity}
                            onChange={e => updateMedicine(index, 'quantity', e.target.value)}
                          />
                          {(() => {
                            const stockItem = campStocks[med.msNo];
                            const remaining = stockItem ? stockItem.remaining : null;
                            if (remaining !== null && med.quantity > remaining) {
                              return <span className="text-[9px] font-bold text-rose-500 uppercase text-center leading-tight">Exceeds<br/>({remaining})</span>
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
