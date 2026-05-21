import React, { useState } from 'react';
import axios from 'axios';
import { 
  Search, 
  History, 
  Activity, 
  TrendingUp, 
  AlertCircle,
  FileText,
  User,
  Calendar,
  Layers,
  ChevronRight,
  Heart,
  Edit,
  X,
  Save,
  PlusCircle,
  Trash2,
  Pill,
  FlaskConical,
  Activity as ActivityIcon,
  Stethoscope,
  Trash,
  Hash,
  CheckCircle2
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
  ChartDataLabels
);

const API_BASE = `http://${window.location.hostname}:8000/api`;

// Reusable Input Component
const VitalInput = ({ icon: Icon, label, value, onChange, type = 'text', placeholder = '', iconColor = 'text-teal-500', required = false }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
      {Icon && <Icon size={10} className={iconColor} strokeWidth={2.5} />}
      {label}
    </label>
    <input
      type={type}
      required={required}
      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all bg-white"
      placeholder={placeholder}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

const PatientProfile = () => {
  const [patientId, setPatientId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Edit Patient State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // Edit Visit State
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitData, setVisitData] = useState({
    id: null,
    date: '',
    blood_pressure: '',
    glucose: '',
    rbs: '',
    haemoglobin: '',
    weight: '',
    height: '',
    pulse: '',
    diagnosis: '',
    dr_name: '',
    dr_id: '',
    medicines: [],
    selected_tests: []
  });
  const [modalTab, setModalTab] = useState('vitals'); // 'vitals', 'medicines', 'tests'

  // Master lists for editing
  const [allMedicines, setAllMedicines] = useState([]);
  const [allTests, setAllTests] = useState([]);

  React.useEffect(() => {
    axios.get(`${API_BASE}/medicines`).then(res => setAllMedicines(res.data));
    axios.get(`${API_BASE}/tests`).then(res => setAllTests(res.data));
  }, []);

  const handleSearch = async (e = null) => {
    if (e) e.preventDefault();
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/patient/${patientId}`);
      if (!res.data.info || Object.keys(res.data.info).length === 0) {
        setError('Patient record not found in the repository');
        setData(null);
      } else {
        setData(res.data);
      }
    } catch (err) {
      setError('Error fetching patient data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    if (!data || !data.info) return;
    setEditingPatient({
      pid: data.patient_id,
      name: data.info.name || '',
      age: data.info.age ? String(data.info.age) : '',
      gender: data.info.gender || '',
      contact: data.info.contact || '',
      address: data.info.address || '',
      regdate: data.info.registered_date || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);

    try {
      // Convert DD/MM/YYYY back to ISO for API
      let apiDate = editingPatient.regdate;
      if (editingPatient.regdate.includes('/')) {
        const [d, m, y] = editingPatient.regdate.split('/');
        apiDate = `${y}-${m}-${d}`;
      }

      await axios.post(`${API_BASE}/register_patient`, {
        ...editingPatient,
        regdate: apiDate
      });
      
      // Update local state
      setData(prev => ({
        ...prev,
        info: {
          ...prev.info,
          name: editingPatient.name,
          age: editingPatient.age,
          gender: editingPatient.gender,
          contact: editingPatient.contact,
          address: editingPatient.address,
          registered_date: editingPatient.regdate
        }
      }));
      
      setIsEditModalOpen(false);
    } catch (err) {
      alert("Error updating patient details: " + (err.response?.data?.message || err.message));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDateChange = (value, setFunction, formState) => {
    let val = value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
    if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5, 10);
    setFunction({ ...formState, regdate: val });
  };

  const handleVisitDateChange = (value) => {
    let val = value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
    if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5, 10);
    setVisitData({ ...visitData, date: val });
  };

  const handleEditVisitClick = async (vId, tab = 'vitals') => {
    setModalTab(tab);
    if (!vId) {
      alert("This record is from an older version of the database and cannot be edited.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/visit_details/${vId}`);
      if (res.data.status === 'success') {
        const d = res.data.vitals;
        let formattedDate = '';
        if (d.date) {
            if (d.date.includes('/')) {
                formattedDate = d.date;
            } else {
                const [y, m, d_val] = d.date.split('-');
                formattedDate = `${d_val}/${m}/${y}`;
            }
        }
        setVisitData({
          id: vId,
          date: formattedDate,
          blood_pressure: d.blood_pressure || '',
          glucose: d.glucose || '',
          rbs: d.rbs || '',
          haemoglobin: d.haemoglobin || '',
          weight: d.weight || '',
          height: d.height || '',
          pulse: d.pulse || '',
          diagnosis: d.diagnosis || '',
          dr_name: d.dr_name || '',
          dr_id: d.dr_id || '',
          medicines: res.data.medicines.map(m => ({
            msNo: m.medicine_id, // Use the UQID (M.S.No) for the inventory lookup
            medicine: m.medicine_name,
            formulation: m.formulation,
            strength: m.strength,
            days: m.days,
            morning: m.morning,
            afternoon: m.afternoon,
            night: m.night,
            qty: m.qty || m.quantity
          })),
          selected_tests: res.data.test_ids
        });
        setIsVisitModalOpen(true);
      }
    } catch (err) {
      alert("Error fetching visit details");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVisit = async (e) => {
    e.preventDefault();
    setVisitSaving(true);
    try {
      // Convert DD/MM/YYYY back to ISO for API
      let apiDate = visitData.date;
      if (visitData.date.includes('/')) {
        const [d, m, y] = visitData.date.split('/');
        apiDate = `${y}-${m}-${d}`;
      }

      const res = await axios.post(`${API_BASE}/update_visit/${visitData.id}`, {
        ...visitData,
        date: apiDate,
        medicines: visitData.medicines.map(m => ({
            ...m,
            quantity: m.qty // Backend expects 'quantity' or 'qty'
        }))
      });
      
      if (res.data.status === 'success') {
        // Refresh full patient profile to ensure charts and history are updated correctly
        const refresh = await axios.get(`${API_BASE}/patient/${patientId}`);
        setData(refresh.data);
        setIsVisitModalOpen(false);
      }
    } catch (err) {
      alert("Update failed: " + (err.response?.data?.message || err.message));
    } finally {
      setVisitSaving(false);
    }
  };

  const handleDeleteVisit = async (vId) => {
    if (!window.confirm("Are you sure you want to delete this visit record? This will also revert any medicine stock issued and remove lab test records.")) return;
    
    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/delete_visit/${vId}`);
      if (res.data.status === 'success') {
        alert("Visit record deleted successfully");
        handleSearch(); // Refresh history
      } else {
        alert("Error: " + res.data.message);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      alert("Error deleting visit: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const updateVisitMedicine = (index, field, value) => {
    const newMeds = [...visitData.medicines];
    newMeds[index] = { ...newMeds[index], [field]: value };
    
    if (field === 'msNo' && value) {
      const found = allMedicines.find(m => m.uqid === parseInt(value));
      if (found) {
        newMeds[index].medicine = found.name;
        newMeds[index].formulation = found.formulation || '';
        newMeds[index].strength = found.strength || '';
      }
    }

    // Auto-calc Qty
    const d = parseInt(newMeds[index].days) || 0;
    const m = parseInt(newMeds[index].morning) || 0;
    const a = parseInt(newMeds[index].afternoon) || 0;
    const n = parseInt(newMeds[index].night) || 0;
    if (d > 0) newMeds[index].qty = d * (m + a + n);

    setVisitData({ ...visitData, medicines: newMeds });
  };

  const chartOptions = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        color: '#1e293b',
        font: { size: 12, weight: 'bold', family: 'Inter' },
        padding: { bottom: 20 }
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#0f172a',
        bodyColor: '#64748b',
        titleFont: { family: 'Inter', size: 13, weight: 'bold' },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        borderColor: '#e2e8f0',
        borderWidth: 1
      },
      datalabels: {
        display: true,
        align: 'top',
        anchor: 'end',
        offset: 4,
        color: '#334155',
        font: { family: 'Inter', size: 10, weight: 'bold' },
        formatter: (value) => value || ''
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
      },
    },
  });

  const hbAnnotations = {
    normalHB: {
      type: 'box', yMin: 12, yMax: 17,
      backgroundColor: 'rgba(34,197,94,0.07)', borderWidth: 0,
      label: { content: 'Normal (12–17)', display: true, position: 'start', font: { size: 9 }, color: '#16a34a' }
    },
    lowHB: {
      type: 'box', yMin: 0, yMax: 12,
      backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 0,
      label: { content: 'Low (<12)', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' }
    }
  };

  const getHBChartData = () => {
    const values = data.charts.haemoglobin.map(i => parseFloat(i.value) || 0);
    return {
      labels: data.charts.haemoglobin.map(i => i.label),
      datasets: [{
        label: 'Haemoglobin',
        data: values,
        borderColor: '#f43f5e',
        borderWidth: 3,
        pointBackgroundColor: values.map(v => v < 12 ? '#dc2626' : v > 17 ? '#f97316' : '#22c55e'),
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
        fill: true,
        tension: 0.4,
      }]
    };
  };

  const sugarAnnotations = {
    normal: {
      type: 'box', yMin: 0, yMax: 140,
      backgroundColor: 'rgba(34,197,94,0.07)', borderWidth: 0,
      label: { content: 'Normal (<140)', display: true, position: 'start', font: { size: 9 }, color: '#16a34a' }
    },
    prediabetic: {
      type: 'box', yMin: 140, yMax: 199,
      backgroundColor: 'rgba(234,179,8,0.08)', borderWidth: 0,
      label: { content: 'Prediabetic (140–199)', display: true, position: 'start', font: { size: 9 }, color: '#a16207' }
    },
    diabetic: {
      type: 'box', yMin: 199, yMax: 600,
      backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 0,
      label: { content: 'Diabetic (≥200)', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' }
    }
  };

  const getSugarChartData = () => {
    const values = data.charts.glucose.map(i => parseFloat(i.value) || 0);
    return {
      labels: data.charts.glucose.map(i => i.label),
      datasets: [{
        label: 'Sugar',
        data: values,
        borderColor: '#f59e0b',
        borderWidth: 3,
        pointBackgroundColor: values.map(v => v >= 200 ? '#dc2626' : v >= 140 ? '#eab308' : '#22c55e'),
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        fill: true,
        tension: 0.4,
      }]
    };
  };

  const bpAnnotations = {
    normal: {
      type: 'box', yMin: 0, yMax: 120,
      backgroundColor: 'rgba(34,197,94,0.07)', borderWidth: 0,
      label: { content: 'Normal (<120)', display: true, position: 'start', font: { size: 9 }, color: '#16a34a' }
    },
    elevated: {
      type: 'box', yMin: 120, yMax: 140,
      backgroundColor: 'rgba(234,179,8,0.08)', borderWidth: 0,
      label: { content: 'Elevated (120–139)', display: true, position: 'start', font: { size: 9 }, color: '#a16207' }
    },
    high: {
      type: 'box', yMin: 140, yMax: 300,
      backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 0,
      label: { content: 'High (≥140)', display: true, position: 'start', font: { size: 9 }, color: '#dc2626' }
    }
  };

  const getBPChartData = () => {
    const systolic = data.charts.blood_pressure.map(i => parseFloat(i.systolic) || 0);
    const diastolic = data.charts.blood_pressure.map(i => parseFloat(i.diastolic) || 0);
    return {
      labels: data.charts.blood_pressure.map(i => i.label),
      datasets: [
        {
          label: 'Systolic',
          data: systolic,
          borderColor: '#0ea5e9',
          borderWidth: 3,
          pointBackgroundColor: systolic.map(v => v >= 140 ? '#dc2626' : v >= 120 ? '#eab308' : '#22c55e'),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
        },
        {
          label: 'Diastolic',
          data: diastolic,
          borderColor: '#8b5cf6',
          borderWidth: 3,
          pointBackgroundColor: diastolic.map(v => v >= 90 ? '#dc2626' : v >= 80 ? '#eab308' : '#22c55e'),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.4,
        }
      ]
    };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-10 px-4">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Heart size={14} className="text-teal-500" />
            <p className="text-teal-600 text-[10px] font-extrabold uppercase tracking-[0.25em]">Patient Management</p>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200">
              <Search className="text-teal-600" size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Analytics & Profile</h3>
          </div>
          <p className="text-slate-400 text-sm font-bold ml-[52px]">Comprehensive Medical History</p>
        </div>
      </div>

      <div className="glass-panel-light p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400" />
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} strokeWidth={2.5} />
            <input
              type="number"
              placeholder="Enter Patient ID (e.g. 10, 18, 19)..."
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-14 pr-6 py-4 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all font-bold"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-3 bg-teal-600 hover:bg-teal-700 text-white px-10 py-4 rounded-xl transition-all shadow-lg shadow-teal-200 font-black text-sm uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search size={18} strokeWidth={3} />
                Fetch Dossier
              </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="flex items-center gap-4 bg-red-50 border border-red-100 text-red-600 p-6 rounded-2xl animate-fade-in shadow-sm">
          <AlertCircle size={24} />
          <div>
            <p className="font-extrabold uppercase tracking-widest text-xs">Repository Alert</p>
            <p className="text-sm font-bold opacity-80">{error}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-12 gap-8 animate-fade-in">
          {/* Identity Card */}
          <div className="col-span-12 flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-6">
               <div className="h-16 w-16 rounded-2xl bg-teal-600 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-teal-200">
                {patientId}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                  <User size={20} className="text-teal-500" /> 
                  {data.info.name || 'Patient Analytics'}
                </h2>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Age</span>
                    <span className="text-xs font-bold text-slate-600">{data.info.age || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gender</span>
                    <span className="text-xs font-bold text-slate-600">{data.info.gender || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact</span>
                    <span className="text-xs font-bold text-slate-600">{data.info.contact || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reg Date</span>
                    <span className="text-xs font-bold text-slate-600">{data.info.registered_date || '—'}</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-100 pl-6">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Address</span>
                    <span className="text-xs font-bold text-slate-600">{data.info.address || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEditClick}
              className="flex items-center gap-2 px-6 py-3 bg-teal-50 text-teal-600 border border-teal-200 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-teal-100 transition-all active:scale-[0.98]"
            >
              <Edit size={16} /> Edit Demographics
            </button>
          </div>

          {/* Charts Row */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: 'hb',    data: getHBChartData,    label: 'haemoglobin',    title: 'Haemoglobin (g/dL)',       annotations: hbAnnotations },
              { id: 'sugar', data: getSugarChartData, label: 'glucose',        title: 'Blood Sugar / RBS (mg/dL)', annotations: sugarAnnotations },
              { id: 'bp',    data: getBPChartData,    label: 'blood_pressure', title: 'Blood Pressure (mmHg)',     annotations: bpAnnotations }
            ].map(chart => (
              data.charts[chart.label] && data.charts[chart.label].length > 0 && (
                <div key={chart.id} className="glass-panel-light p-6 h-[340px] hover:border-teal-500/30 transition-all group">
                  <Line
                    data={chart.data()}
                    options={{
                      ...chartOptions(chart.title),
                      plugins: {
                        ...chartOptions(chart.title).plugins,
                        annotation: { annotations: chart.annotations }
                      }
                    }}
                  />
                </div>
              )
            ))}
          </div>

          {/* Vitals History */}
          <div className="col-span-12 lg:col-span-7 glass-panel-light overflow-hidden p-0">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-teal-50 rounded-2xl">
                  <Activity className="text-teal-600" size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Clinical Vitals History</h3>
              </div>
            </div>
            <div className="overflow-x-auto p-8 pt-0">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                    <th className="py-5">Session Date</th>
                    <th className="py-5">Blood Pressure</th>
                    <th className="py-5">Sugar</th>
                    <th className="py-5">HB</th>
                    <th className="py-5 text-right px-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.vitals.length > 0 ? (
                    data.vitals.map((v, idx) => (
                      <tr key={v.id || idx} className="hover:bg-teal-50/40 transition-colors group">
                        <td className="py-5 text-sm font-bold text-slate-500">{v.date}</td>
                        <td className="py-5 font-data text-blue-600 font-bold">{v.blood_pressure}</td>
                        <td className="py-5 font-data text-amber-600 font-bold">{v.glucose}</td>
                        <td className="py-5 font-data text-rose-600 font-bold">{v.haemoglobin}</td>
                        <td className="py-5 text-right px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleEditVisitClick(v.id, 'vitals')}
                              className="p-2 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                              title="Edit Visit"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteVisit(v.id)}
                              className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Visit"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400 font-bold italic">
                        No clinical vitals recorded for this patient.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Medicine Timeline */}
          <div className="col-span-12 lg:col-span-5 space-y-8">
            <div className="glass-panel-light p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-teal-50 rounded-2xl">
                  <History className="text-teal-600" size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Medicine Fulfillment</h3>
              </div>

              <div className="space-y-8 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
                {Object.keys(data.medicine_history).length > 0 ? (
                  Object.entries(data.medicine_history).map(([camp, info], i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-slate-100 pb-2 last:pb-0">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-teal-500 shadow-sm" />
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em]">{camp}</h4>
                        {info.vitals_id && (
                          <button 
                            onClick={() => handleEditVisitClick(info.vitals_id, 'medicines')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all"
                            title="Edit Medications"
                          >
                            <Edit size={14} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Edit</span>
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {info.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50/50 border border-slate-100 p-4 rounded-xl group hover:border-teal-200 transition-all">
                            <div className="flex items-center gap-3">
                              <Layers size={14} className="text-slate-400 group-hover:text-teal-500 transition-colors" />
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700 group-hover:text-teal-900">{item.medicine}</span>
                                {(item.formulation || item.strength) && (
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">{item.formulation} {item.strength}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1 rounded-lg">
                              {item.qty} QTY
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <History size={32} strokeWidth={1} className="mb-2 opacity-50" />
                    <p className="text-xs font-bold italic">No medicine history found.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lab Tests Section */}
            <div className="glass-panel-light p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-purple-50 rounded-2xl">
                  <FlaskConical className="text-purple-600" size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Lab Tests Issued</h3>
              </div>

              <div className="space-y-8 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
                {data.issued_tests && data.issued_tests.length > 0 ? (
                  // Group by camp_info
                  Object.entries(data.issued_tests.reduce((acc, test) => {
                    const key = test.camp_info || 'Unknown Camp';
                    if (!acc[key]) acc[key] = { vitals_id: test.vitals_record, tests: [] };
                    acc[key].tests.push(test);
                    return acc;
                  }, {})).map(([camp, info], i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-purple-100 pb-2 last:pb-0">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-purple-500 shadow-sm" />
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em]">{camp}</h4>
                        {info.vitals_id && (
                          <button 
                            onClick={() => handleEditVisitClick(info.vitals_id, 'tests')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all"
                            title="Edit Tests"
                          >
                            <Edit size={14} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Edit</span>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {info.tests.map((test, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-purple-50/30 border border-purple-100/50 p-3 rounded-xl">
                            <div className="p-1.5 bg-white rounded-lg shadow-sm">
                              <CheckCircle2 size={12} className={test.reports_issued ? "text-emerald-500" : "text-slate-300"} />
                            </div>
                            <span className="text-xs font-bold text-slate-700">{test.test_name}</span>
                            {test.reports_issued && (
                              <span className="ml-auto text-[8px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-tighter">Issued</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <FlaskConical size={32} strokeWidth={1} className="mb-2 opacity-50" />
                    <p className="text-xs font-bold italic">No lab tests issued.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!data && !error && !loading && (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
          <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 mb-8">
            <FileText size={80} strokeWidth={1} className="text-slate-300" />
          </div>
          <h4 className="text-2xl font-black text-slate-400 mb-2 tracking-tight uppercase tracking-widest text-lg">Diagnostics Repository</h4>
          <p className="text-slate-400 max-w-sm text-center font-bold text-sm">Input a patient ID to retrieve and visualize clinical metrics and medicine history.</p>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Edit size={16} className="text-teal-500" /> Edit Patient Profile
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient Name</label>
                <input 
                  type="text" 
                  value={editingPatient.name}
                  onChange={(e) => setEditingPatient({...editingPatient, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                  <input 
                    type="number" 
                    value={editingPatient.age}
                    onChange={(e) => setEditingPatient({...editingPatient, age: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                  <select 
                    value={editingPatient.gender}
                    onChange={(e) => setEditingPatient({...editingPatient, gender: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact No.</label>
                  <input 
                    type="text" 
                    value={editingPatient.contact}
                    onChange={(e) => setEditingPatient({...editingPatient, contact: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registration Date</label>
                  <input 
                    type="text" 
                    placeholder="DD/MM/YYYY"
                    value={editingPatient.regdate}
                    onChange={(e) => handleDateChange(e.target.value, setEditingPatient, editingPatient)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                <textarea 
                  value={editingPatient.address}
                  onChange={(e) => setEditingPatient({...editingPatient, address: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none min-h-[80px]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={editSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-teal-100 disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : <><Save size={14} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Visit Modal */}
      {isVisitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col animate-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 border border-teal-100">
                   <ActivityIcon size={24} />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-800 tracking-tight">Edit Visit Record</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Patient ID: {patientId} • Visit ID: {visitData.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsVisitModalOpen(false)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs Header */}
            <div className="flex border-b border-slate-100 bg-white">
              {['vitals', 'medicines', 'tests'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setModalTab(tab)}
                  className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${
                    modalTab === tab 
                    ? 'text-teal-600 border-teal-500 bg-teal-50/30' 
                    : 'text-slate-400 border-transparent hover:bg-slate-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleUpdateVisit} className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-8 space-y-10">
                
                {/* 1. Vitals Section */}
                {modalTab === 'vitals' && (
                  <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                    <Stethoscope size={14} className="text-teal-500" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Clinical Vitals</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <VitalInput label="Weight (kg)" value={visitData.weight} onChange={v => setVisitData({...visitData, weight: v})} icon={ActivityIcon} iconColor="text-amber-500" />
                    <VitalInput label="Height (cm)" value={visitData.height} onChange={v => setVisitData({...visitData, height: v})} icon={ActivityIcon} iconColor="text-blue-500" />
                    <VitalInput label="BP (mmHg)" value={visitData.blood_pressure} onChange={v => setVisitData({...visitData, blood_pressure: v})} icon={Heart} iconColor="text-rose-500" />
                    <VitalInput label="Pulse (BPM)" value={visitData.pulse} onChange={v => setVisitData({...visitData, pulse: v})} icon={ActivityIcon} iconColor="text-pink-500" />
                    <VitalInput label="RBS" value={visitData.rbs} onChange={v => setVisitData({...visitData, rbs: v})} icon={ActivityIcon} iconColor="text-orange-500" />
                    <VitalInput label="Hemoglobin" value={visitData.haemoglobin} onChange={v => setVisitData({...visitData, haemoglobin: v})} icon={ActivityIcon} iconColor="text-rose-600" />
                    <VitalInput label="Date (DD/MM/YYYY)" value={visitData.date} onChange={handleVisitDateChange} icon={Calendar} iconColor="text-teal-600" />
                    <VitalInput label="Dr. ID" value={visitData.dr_id} onChange={v => setVisitData({...visitData, dr_id: v})} icon={Hash} iconColor="text-indigo-500" />
                    <VitalInput label="Attending Dr." value={visitData.dr_name} onChange={v => setVisitData({...visitData, dr_name: v})} icon={Stethoscope} iconColor="text-blue-600" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Diagnosis</label>
                    <textarea 
                      value={visitData.diagnosis}
                      onChange={e => setVisitData({...visitData, diagnosis: e.target.value})}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none min-h-[80px]"
                    />
                  </div>
                </section>
                )}

                {/* 2. Medicine Section */}
                {modalTab === 'medicines' && (
                <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                    <div className="flex items-center gap-2">
                      <Pill size={14} className="text-emerald-500" />
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Medications Issued</h4>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setVisitData({...visitData, medicines: [...visitData.medicines, { msNo: '', medicine: '', formulation: '', strength: '', qty: '' }]})}
                      className="flex items-center gap-2 text-[10px] font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all"
                    >
                      <PlusCircle size={12} /> Add Item
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-4 py-3 w-16">M.S.No</th>
                          <th className="px-4 py-3 w-44">Medicine</th>
                          <th className="px-4 py-3 w-36">Form.</th>
                          <th className="px-4 py-3 w-24">Str.</th>
                          <th className="px-4 py-3 w-20 text-emerald-600">Qty</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {visitData.medicines.map((med, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50/50">
                            <td className="p-2">
                              <input 
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-black text-teal-600 text-center"
                                value={med.msNo}
                                onChange={e => updateVisitMedicine(idx, 'msNo', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold"
                                value={med.medicine}
                                onChange={e => updateVisitMedicine(idx, 'medicine', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
                                value={med.formulation}
                                onChange={e => updateVisitMedicine(idx, 'formulation', e.target.value)}
                                placeholder="Tab/Syr"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
                                value={med.strength}
                                onChange={e => updateVisitMedicine(idx, 'strength', e.target.value)}
                                placeholder="500mg"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                className="w-full bg-emerald-50/50 border border-emerald-200 rounded-lg px-2 py-1.5 text-xs font-black text-emerald-700 text-center focus:ring-2 focus:ring-emerald-500/30 outline-none"
                                value={med.qty}
                                onChange={e => updateVisitMedicine(idx, 'qty', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td className="p-2">
                              <button 
                                type="button"
                                onClick={() => setVisitData({...visitData, medicines: visitData.medicines.filter((_, i) => i !== idx)})}
                                className="p-1.5 text-slate-300 hover:text-rose-500 rounded-md transition-all"
                              >
                                <Trash size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                )}

                {/* 3. Lab Tests */}
                {modalTab === 'tests' && (
                <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                   <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                    <FlaskConical size={14} className="text-purple-500" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Lab Tests</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {allTests.map(test => (
                      <label 
                        key={test.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                          visitData.selected_tests.includes(test.test_id)
                            ? 'bg-purple-50 border-purple-200 text-purple-700'
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          className="sr-only"
                          checked={visitData.selected_tests.includes(test.test_id)}
                          onChange={() => {
                            const newTests = visitData.selected_tests.includes(test.test_id)
                              ? visitData.selected_tests.filter(id => id !== test.test_id)
                              : [...visitData.selected_tests, test.test_id];
                            setVisitData({...visitData, selected_tests: newTests});
                          }}
                        />
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                           visitData.selected_tests.includes(test.test_id) ? 'bg-purple-600 border-purple-600' : 'border-slate-300'
                        }`}>
                          {visitData.selected_tests.includes(test.test_id) && <X size={10} className="text-white" strokeWidth={4} />}
                        </div>
                        <span className="text-[11px] font-bold">{test.name}</span>
                      </label>
                    ))}
                  </div>
                </section>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-slate-100 flex items-center justify-end gap-4 bg-slate-50/50">
                 <button 
                  type="button"
                  onClick={() => setIsVisitModalOpen(false)}
                  className="px-6 py-3 text-xs font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest transition-all"
                >
                  Cancel Changes
                </button>
                <button 
                  type="submit"
                  disabled={visitSaving}
                  className="flex items-center gap-3 px-10 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-teal-100 disabled:opacity-50"
                >
                  {visitSaving ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={18} /> Update Medical Record
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;

