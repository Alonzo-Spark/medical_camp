import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Activity, Database, Edit2, Trash2, ArrowLeft } from 'lucide-react';

const DoctorPatientList = () => {
  const navigate = useNavigate();
  const API_BASE = `http://${window.location.hostname}:8000/api`;

  const [camps, setCamps] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [dbData, setDbData] = useState(null);
  const [manualRecords, setManualRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCamps();
  }, []);

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
  };

  const filteredManualRecords = manualRecords.filter(record => record.campId == selectedCamp);

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 rounded-2xl">
            <Users className="text-teal-600" size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Doctor Patient List</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Manage Doctor and Patient Assignments</p>
          </div>
          <div className="ml-2">
            <button
              onClick={() => navigate('/doctor-consultation-log')}
              className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center gap-2 border border-slate-200"
            >
              <ArrowLeft size={16} strokeWidth={2.5} />
              Back to Consultation Log
            </button>
          </div>
        </div>
      </div>

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

      <div className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-slate-200">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
          </div>
        ) : (
          <>
            {/* Unified Database & Manual Records */}
            {(() => {
              const doctorsMap = new Map();

              if (dbData && dbData.doctors) {
                dbData.doctors.forEach(dr => {
                  const key = dr.dr_id ? dr.dr_id.toString() : dr.dr_name;
                  doctorsMap.set(key, {
                    dr_id: dr.dr_id,
                    dr_name: dr.dr_name,
                    dbPatientsCount: dr.patients.length,
                    manualPatientsCount: 0,
                    patients: dr.patients.map(p => ({ ...p, isManual: false }))
                  });
                });
              }

              filteredManualRecords.forEach(record => {
                const key = record.doctorId ? record.doctorId.toString() : record.doctorName;
                if (!doctorsMap.has(key)) {
                  doctorsMap.set(key, {
                    dr_id: record.doctorId,
                    dr_name: record.doctorName,
                    dbPatientsCount: 0,
                    manualPatientsCount: 0,
                    patients: []
                  });
                }
                
                const doc = doctorsMap.get(key);
                doc.manualPatientsCount += 1;
                doc.patients.push({
                  patient_id: record.patientId,
                  patient_name: record.patientName,
                  source: 'Manually Added',
                  isManual: true,
                  recordId: record.id,
                  rawRecord: record
                });
              });

              const unifiedDoctors = Array.from(doctorsMap.values());

              if (!selectedCamp) {
                return (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-slate-50 rounded-full">
                        <Activity className="text-slate-300" size={32} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-800">Select a Camp</p>
                        <p className="text-sm text-slate-500 mt-1">Please select a medical camp from the dropdown above to view patient records.</p>
                      </div>
                    </div>
                  </div>
                );
              }

              if (unifiedDoctors.length === 0) {
                return (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
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
                );
              }

              return unifiedDoctors.map((dr, drIdx) => (
                <div key={`doc-${drIdx}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                        {dr.dr_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                          {dr.dr_name || "Unknown Doctor"}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {dr.dr_id && (
                            <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              ID: {dr.dr_id}
                            </span>
                          )}
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {dr.dbPatientsCount + dr.manualPatientsCount} Patients Assigned
                            {dr.dbPatientsCount > 0 && ` (${dr.dbPatientsCount} DB)`}
                            {dr.manualPatientsCount > 0 && ` (${dr.manualPatientsCount} Manual)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                          <th className="p-4 pl-6">Patient ID / Name</th>
                          <th className="p-4 text-center">Source</th>
                          <th className="p-4 text-right pr-6">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {dr.patients.map((p, pIdx) => (
                          <tr key={pIdx} className="hover:bg-slate-50/30 transition-colors group">
                            <td className="p-4 pl-6 align-middle">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-700">{p.patient_name}</span>
                                <span className="text-[10px] font-bold text-slate-400 mt-0.5">ID: {p.patient_id || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="p-4 align-middle text-center">
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
                            <td className="p-4 pr-6 align-middle text-right">
                              {p.isManual ? (
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleDelete(p.recordId)}
                                    className="p-1.5 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all active:scale-95 shadow-sm"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} strokeWidth={2.5} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest italic">DB Record</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ));
            })()}
          </>
        )}
      </div>

    </div>
  );
};

export default DoctorPatientList;
