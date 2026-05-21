import React, { useState, useEffect } from 'react';
import { FileText, Activity, Save, Edit2, Trash2, Users, Plus, X, Database } from 'lucide-react';

const DoctorReport = () => {
  const API_BASE = `http://${window.location.hostname}:8000/api`;

  const [camps, setCamps] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [dbData, setDbData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Manual records state for UI
  const [manualRecords, setManualRecords] = useState([]);
  const initialFormState = { doctorId: '', doctorName: '', patients: [{ patientId: '', patientName: '' }] };
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [allDoctors, setAllDoctors] = useState([]);

  // Fetch Camps & Doctors from DB
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

  const fetchCampDetails = async (campId) => {
    if (!campId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/camp_details/${campId}`);
      const data = await res.json();
      setDbData(data);
    } catch (err) {
      console.error("Error fetching camp details:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchManualRecords = async (campId) => {
    if (!campId) return;
    try {
      const res = await fetch(`${API_BASE}/doctor_camp_reports/${campId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
          setManualRecords(data);
      }
    } catch (err) {
      console.error("Error fetching manual records:", err);
    }
  };

  const handleCampChange = (e) => {
    const campId = e.target.value;
    setSelectedCamp(campId);
    fetchCampDetails(campId);
    fetchManualRecords(campId);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const filteredManualRecords = manualRecords.filter(record => record.campId == selectedCamp);

  const handleSaveManual = async (e) => {
    e.preventDefault();
    if (!selectedCamp) {
      alert("Please select a camp first.");
      return;
    }
    if (!formData.doctorName || formData.patients.some(p => !p.patientId || !p.patientName)) return;

    try {
      if (editingId) {
        const p = formData.patients[0];
        const payload = {
          id: editingId,
          campId: selectedCamp,
          doctorId: formData.doctorId,
          doctorName: formData.doctorName,
          patientId: p.patientId,
          patientName: p.patientName
        };
        
        const res = await fetch(`${API_BASE}/save_doctor_report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.status === 'success') {
          setManualRecords(manualRecords.map(rec => rec.id === editingId ? result.record : rec));
          setEditingId(null);
          setFormData(initialFormState);
        } else {
          alert("Error saving record: " + result.message);
        }
      } else {
        const promises = formData.patients.map(p => {
          const payload = {
            id: null,
            campId: selectedCamp,
            doctorId: formData.doctorId,
            doctorName: formData.doctorName,
            patientId: p.patientId,
            patientName: p.patientName
          };
          return fetch(`${API_BASE}/save_doctor_report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(res => res.json());
        });

        const results = await Promise.all(promises);
        const newRecords = [];
        let hasError = false;
        for (const result of results) {
          if (result.status === 'success') {
            newRecords.push(result.record);
          } else {
            hasError = true;
            alert("Error saving record: " + result.message);
          }
        }
        
        setManualRecords([...manualRecords, ...newRecords]);
        if (!hasError) {
          setFormData({ doctorId: formData.doctorId, doctorName: formData.doctorName, patients: [{ patientId: '', patientName: '' }] });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDoctorIdBlur = () => {
    setFormData(prev => {
      if (!prev.doctorId) return prev;
      const docObj = allDoctors.find(d => d.id.toString() === prev.doctorId.toString());
      if (docObj) {
        return { ...prev, doctorName: docObj.dr_name };
      } else {
        return { ...prev, doctorName: 'Doctor Not Found' };
      }
    });
  };

  const handlePatientIdBlur = async (index) => {
    const pId = formData.patients[index].patientId;
    if (!pId) return;
    try {
      const res = await fetch(`${API_BASE}/check_patient_id/${pId}`);
      const data = await res.json();
      const newPatients = [...formData.patients];
      if (data.exists) {
        newPatients[index].patientName = data.patient_name;
      } else {
        newPatients[index].patientName = 'Patient Not Found';
      }
      setFormData(prev => ({ ...prev, patients: newPatients }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setFormData({
      doctorId: record.doctorId || '',
      doctorName: record.doctorName,
      patients: [{ patientId: record.patientId, patientName: record.patientName }]
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this manual record?')) {
      try {
        await fetch(`${API_BASE}/delete_doctor_report/${id}`, { method: 'DELETE' });
        setManualRecords(manualRecords.filter(rec => rec.id !== id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(initialFormState);
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
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Consolidated Database & Manual Consultations</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Section */}
        {selectedCamp && (
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit sticky top-6">
          <h3 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2">
            {editingId ? <Edit2 className="text-teal-500" size={20} /> : <Plus className="text-teal-500" size={20} />}
            {editingId ? 'Edit Manual Record' : 'Add Manual Patient'}
          </h3>
          
          <form onSubmit={handleSaveManual} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Doctor ID</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 4"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                  value={formData.doctorId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, doctorId: val }));
                  }}
                  onBlur={handleDoctorIdBlur}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Doctor Name</label>
                <input
                  type="text"
                  required
                  placeholder="Auto-filled or type manually"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                  value={formData.doctorName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, doctorName: val }));
                  }}
                />
              </div>
            </div>

            {formData.patients.map((patient, index) => (
              <div key={index} className="relative bg-slate-50 p-4 rounded-xl border border-slate-100">
                {formData.patients.length > 1 && !editingId && (
                  <button 
                    type="button" 
                    onClick={() => {
                      const newPatients = [...formData.patients];
                      newPatients.splice(index, 1);
                      setFormData(prev => ({ ...prev, patients: newPatients }));
                    }}
                    className="absolute -top-2 -right-2 bg-rose-100 text-rose-600 rounded-full p-1 hover:bg-rose-200 transition-colors shadow-sm"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient ID</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 1001"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                      value={patient.patientId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newPatients = [...formData.patients];
                        newPatients[index].patientId = val;
                        setFormData(prev => ({ ...prev, patients: newPatients }));
                      }}
                      onBlur={() => handlePatientIdBlur(index)}
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Auto-filled or type manually"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                      value={patient.patientName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newPatients = [...formData.patients];
                        newPatients[index].patientName = val;
                        setFormData(prev => ({ ...prev, patients: newPatients }));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {!editingId && (
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, patients: [...prev.patients, { patientId: '', patientName: '' }] }));
                }}
                className="w-full py-2.5 border-2 border-dashed border-teal-200 text-teal-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-teal-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} strokeWidth={3} />
                Add Another Patient
              </button>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all shadow-md shadow-teal-100 flex items-center justify-center gap-2"
              >
                <Save size={16} strokeWidth={2.5} />
                {editingId ? 'Update' : 'Save'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3.5 rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2"
                >
                  <X size={16} strokeWidth={2.5} />
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
        )}

        {/* Database & Manual Records Display */}
        <div className={selectedCamp ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          {loading ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-slate-200">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
            </div>
          ) : (
            <>
              {/* Database Records */}
              {dbData && dbData.doctors && dbData.doctors.map((dr, drIdx) => (
                <div key={`db-${drIdx}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                        {dr.dr_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                          {dr.dr_name || "Unknown Doctor"}
                          <Database size={14} className="text-teal-500" title="From Database" />
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {dr.dr_id && (
                            <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              ID: {dr.dr_id}
                            </span>
                          )}
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{dr.patients.length} DB Patients</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                          <th className="p-4 pl-6">Patient ID / Name</th>
                          <th className="p-4 text-right pr-6">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {dr.patients.map((p, pIdx) => (
                          <tr key={pIdx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-4 pl-6 align-middle">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-700">{p.patient_name}</span>
                                <span className="text-[10px] font-bold text-slate-400 mt-0.5">ID: {p.patient_id || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="p-4 pr-6 align-middle text-right">
                              {p.source === 'Logged Vitals' ? (
                                <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[10px] font-extrabold uppercase tracking-wide">
                                  Vitals Logged
                                </span>
                              ) : p.source === 'Manually Added' ? (
                                <span className="inline-block px-2.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[10px] font-extrabold uppercase tracking-wide">
                                  Manually Added
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 bg-slate-50 text-slate-500 border border-slate-100 rounded text-[10px] font-extrabold uppercase tracking-wide">
                                  {p.source || 'Database'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}

                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Group Manual Records by Doctor */}
              {filteredManualRecords.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4 px-2">
                    <Edit2 className="text-amber-500" size={18} />
                    Manual Patient Entries
                  </h3>
                  
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-amber-50/30 border-b border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                          <th className="p-4 pl-6">Doctor Name</th>
                          <th className="p-4">Patient Details</th>
                          <th className="p-4 pr-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredManualRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-amber-50/10 transition-colors group">
                            <td className="p-4 pl-6 align-middle">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800">{record.doctorName}</span>
                                {record.doctorId && (
                                  <span className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Doc ID: {record.doctorId}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 align-middle">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700">{record.patientName}</span>
                                <span className="text-[10px] font-bold text-amber-600 mt-0.5">ID: {record.patientId}</span>
                              </div>
                            </td>
                            <td className="p-4 pr-6 align-middle text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-all active:scale-95 shadow-sm"
                                  title="Edit"
                                >
                                  <Edit2 size={14} strokeWidth={2.5} />
                                </button>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="p-1.5 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all active:scale-95 shadow-sm"
                                  title="Delete"
                                >
                                  <Trash2 size={14} strokeWidth={2.5} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(!selectedCamp) ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                   <div className="flex flex-col items-center gap-3">
                     <div className="p-3 bg-slate-50 rounded-full">
                       <Activity className="text-slate-300" size={32} />
                     </div>
                     <div>
                       <p className="text-lg font-black text-slate-800">Select a Camp</p>
                       <p className="text-sm text-slate-500 mt-1">Please select a medical camp from the dropdown above to view or add records.</p>
                     </div>
                   </div>
                </div>
              ) : (!dbData || !dbData.doctors || dbData.doctors.length === 0) && filteredManualRecords.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                   <div className="flex flex-col items-center gap-3">
                     <div className="p-3 bg-slate-50 rounded-full">
                       <Users className="text-slate-300" size={32} />
                     </div>
                     <div>
                       <p className="text-lg font-black text-slate-800">No Patient Records</p>
                       <p className="text-sm text-slate-500 mt-1">No database or manual patients were found for this camp.</p>
                     </div>
                   </div>
                </div>
              ) : null}
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default DoctorReport;
