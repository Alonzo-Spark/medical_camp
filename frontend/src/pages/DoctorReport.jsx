import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Activity, Save, Users, Plus } from 'lucide-react';

const DoctorReport = () => {
  const API_BASE = `http://${window.location.hostname}:8000/api`;

  const [camps, setCamps] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [allDoctors, setAllDoctors] = useState([]);
  const [inputs, setInputs] = useState({}); // { doctorId: { patientId: '', patientName: '' } }
  const navigate = useNavigate();

  useEffect(() => {
    fetchCamps();
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`${API_BASE}/doctors`);
      const data = await res.json();
      setAllDoctors(data);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  };

  const fetchCamps = async () => {
    try {
      const res = await fetch(`${API_BASE}/camps`);
      const data = await res.json();
      setCamps(data);
    } catch (err) {
      console.error("Error fetching camps:", err);
    }
  };

  const handleCampChange = (e) => {
    setSelectedCamp(e.target.value);
    setInputs({});
  };

  const updateInput = (doctorId, field, value) => {
    setInputs(prev => ({
      ...prev,
      [doctorId]: {
        ...(prev[doctorId] || { patientId: '', patientName: '' }),
        [field]: value
      }
    }));
  };

  const handlePatientIdBlur = async (doctorId) => {
    const pId = inputs[doctorId]?.patientId;
    if (!pId) return;
    try {
      const res = await fetch(`${API_BASE}/check_patient_id/${pId}`);
      const data = await res.json();
      if (data.exists) {
        updateInput(doctorId, 'patientName', data.patient_name);
      } else {
        updateInput(doctorId, 'patientName', 'Patient Not Found');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPatient = async (doctor) => {
    if (!selectedCamp) {
      alert("Please select a camp first.");
      return;
    }
    const docInput = inputs[doctor.dr_id || doctor.id];
    if (!docInput || !docInput.patientId || !docInput.patientName) {
      alert("Please fill in both Patient ID and Patient Name.");
      return;
    }

    const payload = {
      id: null,
      campId: selectedCamp,
      doctorId: doctor.dr_id,
      doctorName: doctor.dr_name,
      patientId: docInput.patientId,
      patientName: docInput.patientName
    };

    try {
      const res = await fetch(`${API_BASE}/save_doctor_report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      
      if (result.status === 'success') {
        setInputs(prev => ({
          ...prev,
          [doctor.dr_id || doctor.id]: { patientId: '', patientName: '' }
        }));
      } else {
        alert("Error saving record: " + result.message);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 rounded-2xl">
            <FileText className="text-teal-600" size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Doctor Consultation Log</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Add patients to active doctors</p>
          </div>
          <div className="ml-2">
            <button
              onClick={() => navigate('/doctor-patient-list')}
              className="bg-teal-50 hover:bg-teal-100 text-teal-700 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center gap-2 border border-teal-100"
            >
              <Users size={16} strokeWidth={2.5} />
              Doctor Patient List
            </button>
          </div>
        </div>
      </div>

      {/* Camp Selector */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg">
            <Activity className="text-amber-600" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">Select Medical Camp</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Filter records by camp</p>
          </div>
        </div>
        
        <select
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer"
          value={selectedCamp}
          onChange={handleCampChange}
        >
          <option value="">Select Camp</option>
          {camps.map((c) => (
            <option key={c.id} value={c.id}>
              Camp #{c.number} — {c.venue}
            </option>
          ))}
        </select>
      </div>

      {/* Active Doctors List */}
      <div className="space-y-6">
        {!selectedCamp ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
             <div className="flex flex-col items-center gap-3">
               <div className="p-3 bg-slate-50 rounded-full">
                 <Activity className="text-slate-300" size={32} />
               </div>
               <div>
                 <p className="text-lg font-black text-slate-800">Select a Camp</p>
                 <p className="text-sm text-slate-500 mt-1">Please select a medical camp from the dropdown above to assign patients.</p>
               </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {allDoctors.filter(d => d.is_active).map(dr => {
              const docId = dr.dr_id || dr.id;
              const docInput = inputs[docId] || { patientId: '', patientName: '' };
              return (
                <div key={docId} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                      {dr.dr_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-800 tracking-tight">{dr.dr_name}</h4>
                      {dr.dr_id && (
                        <span className="inline-block mt-1 text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded uppercase tracking-wider">
                          ID: {dr.dr_id}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-auto space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient ID</label>
                        <input
                          type="number"
                          placeholder="e.g. 1001"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                          value={docInput.patientId}
                          onChange={(e) => updateInput(docId, 'patientId', e.target.value)}
                          onBlur={() => handlePatientIdBlur(docId)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient Name</label>
                        <input
                          type="text"
                          placeholder="Auto-filled"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                          value={docInput.patientName}
                          onChange={(e) => updateInput(docId, 'patientName', e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddPatient(dr)}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                      Add Patient
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorReport;
