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
  Save
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_BASE = 'http://127.0.0.1:8000/api';

const PatientProfile = () => {
  const [patientId, setPatientId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Edit Patient State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
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
      await axios.post(`${API_BASE}/register_patient`, {
        ...editingPatient
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

  const chartOptions = (title, color) => ({
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
      }
    },
    scales: {
      y: { 
        grid: { color: 'rgba(0, 0, 0, 0.05)', drawBorder: false }, 
        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } 
      },
      x: { 
        grid: { display: false }, 
        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } 
      },
    },
  });

  const getHBChartData = () => ({
    labels: data.charts.haemoglobin.map(i => i.label),
    datasets: [{
      label: 'Haemoglobin',
      data: data.charts.haemoglobin.map(i => parseFloat(i.value) || 0),
      borderColor: '#f43f5e',
      borderWidth: 3,
      pointBackgroundColor: '#f43f5e',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      backgroundColor: 'rgba(244, 63, 94, 0.05)',
      fill: true,
      tension: 0.4,
    }]
  });

  const getSugarChartData = () => ({
    labels: data.charts.glucose.map(i => i.label),
    datasets: [{
      label: 'Sugar',
      data: data.charts.glucose.map(i => parseFloat(i.value) || 0),
      borderColor: '#f59e0b',
      borderWidth: 3,
      pointBackgroundColor: '#f59e0b',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      backgroundColor: 'rgba(245, 158, 11, 0.05)',
      fill: true,
      tension: 0.4,
    }]
  });

  const getBPChartData = () => {
    return {
      labels: data.charts.blood_pressure.map(i => i.label),
      datasets: [
        {
          label: 'Systolic',
          data: data.charts.blood_pressure.map(i => parseFloat(i.systolic) || 0),
          borderColor: '#0ea5e9',
          borderWidth: 3,
          pointBackgroundColor: '#0ea5e9',
          pointBorderColor: '#ffffff',
          pointRadius: 4,
          tension: 0.4,
        },
        {
          label: 'Diastolic',
          data: data.charts.blood_pressure.map(i => parseFloat(i.diastolic) || 0),
          borderColor: '#8b5cf6',
          borderWidth: 3,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#ffffff',
          pointRadius: 4,
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
              { id: 'hb', data: getHBChartData, label: 'haemoglobin', title: 'Haemoglobin trend', color: 'red' },
              { id: 'sugar', data: getSugarChartData, label: 'glucose', title: 'Sugar / Glucose trend', color: 'amber' },
              { id: 'bp', data: getBPChartData, label: 'blood_pressure', title: 'Blood Pressure trend', color: 'blue' }
            ].map(chart => (
              data.charts[chart.label] && data.charts[chart.label].length > 0 && (
                <div key={chart.id} className="glass-panel-light p-6 h-[320px] hover:border-teal-500/30 transition-all group">
                  <Line data={chart.data()} options={chartOptions(chart.title, chart.color)} />
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.vitals.length > 0 ? (
                    data.vitals.map((v) => (
                      <tr key={v.date} className="hover:bg-teal-50/40 transition-colors group">
                        <td className="py-5 text-sm font-bold text-slate-500">{v.date}</td>
                        <td className="py-5 font-data text-blue-600 font-bold">{v.blood_pressure}</td>
                        <td className="py-5 font-data text-amber-600 font-bold">{v.glucose}</td>
                        <td className="py-5 font-data text-rose-600 font-bold">{v.haemoglobin}</td>
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
          <div className="col-span-12 lg:col-span-5 glass-panel-light p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-teal-50 rounded-2xl">
                <History className="text-teal-600" size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Medicine Fulfillment</h3>
            </div>

            <div className="space-y-8 max-h-[600px] overflow-auto pr-2 custom-scrollbar">
              {Object.keys(data.medicine_history).length > 0 ? (
                Object.entries(data.medicine_history).map(([camp, items], i) => (
                  <div key={i} className="relative pl-6 border-l-2 border-slate-100 pb-2 last:pb-0">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-teal-500 shadow-sm" />
                    <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] mb-4">{camp}</h4>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={`${camp}-${item.medicine}`} className="flex items-center justify-between bg-slate-50/50 border border-slate-100 p-4 rounded-xl group hover:border-teal-200 transition-all">
                          <div className="flex items-center gap-3">
                            <Layers size={14} className="text-slate-400 group-hover:text-teal-500 transition-colors" />
                            <span className="text-sm font-bold text-slate-700 group-hover:text-teal-900">{item.medicine}</span>
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
                    type="date" 
                    value={editingPatient.regdate}
                    onChange={(e) => setEditingPatient({...editingPatient, regdate: e.target.value})}
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
    </div>
  );
};

export default PatientProfile;

