import React, { useState, useEffect } from 'react';
import { UserCircle, Search, Users, Activity, Edit2, Save, X, Trash2, CheckCircle2, XCircle, Download } from 'lucide-react';

const DoctorsList = () => {

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('doctorsList');

  // Registration form state
  const [newDr, setNewDr] = useState({ name: '', specialization: '' });
  const [regLoading, setRegLoading] = useState(false);

  // Analytics state
  const [camps, setCamps] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [detailedData, setDetailedData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Local state for editing
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ dr_name: '', dr_id: '', specialization: '' });

  const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`;

  useEffect(() => {
    fetchCamps();
  }, []);

  useEffect(() => {
    if (activeTab === 'doctorsList') fetchDoctors();
  }, [activeTab, selectedCamp]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const endpoint = selectedCamp ? `${API_BASE}/camp_doctors/${selectedCamp}` : `${API_BASE}/doctors`;
      const res = await fetch(endpoint);
      let data = await res.json();
      
      // Frontend override to correct spelling without breaking backend analytics
      data = data.map(doc => ({
        ...doc,
        dr_name: doc.dr_name ? doc.dr_name.replace(/Muqueeth/i, 'Muqeedh') : doc.dr_name
      }));

      setDoctors(data);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCamps = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/camps`);
      const data = await res.json();
      setCamps(data);
      // Optional: don't auto-select the first camp to show "Select Camp..." placeholder
      // if (data.length > 0 && !selectedCamp) {
      //   setSelectedCamp(data[0].id);
      //   fetchCampDetails(data[0].id);
      // }
    } catch (err) {
      console.error("Error fetching camps:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchCampDetails = async (campId) => {
    if (!campId) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/camp_details/${campId}`);
      let data = await res.json();
      
      // Frontend override to correct spelling without breaking backend analytics
      if (data && data.doctors) {
        data.doctors = data.doctors.map(doc => ({
          ...doc,
          dr_name: doc.dr_name ? doc.dr_name.replace(/Muqueeth/i, 'Muqeedh') : doc.dr_name
        }));
      }

      setDetailedData(data);
    } catch (err) {
      console.error("Error fetching camp details:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };



  const handleRegisterDoctor = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    try {
      // We'll need a new endpoint or use an existing one if available.
      // For now, let's assume we can add them.
      const res = await fetch(`${API_BASE}/add_doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDr)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setNewDr({ name: '', specialization: '' });
        setActiveTab('doctorsList');
        fetchDoctors();
      }
    } catch (err) {
      console.error("Error registering doctor:", err);
    } finally {
      setRegLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this doctor?")) return;
    try {
      const res = await fetch(`${API_BASE}/delete_doctor/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchDoctors();
      } else {
        alert("Error deleting doctor: " + data.message);
      }
    } catch (err) {
      console.error("Error deleting doctor:", err);
      alert("Failed to delete doctor.");
    }
  };
  const handleToggleStatus = async (id) => {
    try {
      let res;
      if (selectedCamp) {
        res = await fetch(`${API_BASE}/toggle_camp_doctor_status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camp_id: selectedCamp, doctor_id: id })
        });
      } else {
        res = await fetch(`${API_BASE}/toggle_doctor_status/${id}`, {
          method: 'POST'
        });
      }
      const data = await res.json();
      if (data.status === 'success') {
        fetchDoctors();
      }
    } catch (err) {
      console.error("Error toggling status:", err);
    }
  };




  const filteredDoctors = doctors
    .filter(doc =>
      doc.dr_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.dr_id && doc.dr_id.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => parseInt(a.dr_id, 10) - parseInt(b.dr_id, 10));

  const handleEditClick = (doc) => {
    setEditingId(doc.dr_id || doc.dr_name); // use dr_id or name as unique key for this view
    setEditForm({
      dr_name: doc.dr_name,
      dr_id: doc.dr_id || '',
      specialization: doc.specialization
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    try {
      const res = await fetch(`${API_BASE}/update_doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dr_id: editingId,
          dr_name: editForm.dr_name,
          specialization: editForm.specialization

        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchDoctors(); // Refresh list from server
        setEditingId(null);
      } else {
        alert("Error updating doctor: " + data.message);
      }
    } catch (err) {
      console.error("Error saving doctor:", err);
      alert("Failed to save changes.");
    }
  };

  const downloadCSV = () => {
    const headers = ['Doctor ID', 'Doctor Name', 'Specialization', 'Status'];
    const rows = filteredDoctors.map(doc => [
      doc.dr_id || '',
      `"${doc.dr_name || ''}"`,
      `"${doc.specialization || 'Not Specified'}"`,
      doc.is_active ? 'Active' : 'Inactive'
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `doctors_list_${selectedCamp ? 'camp_'+selectedCamp : 'global'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 rounded-2xl">
            <UserCircle className="text-teal-600" size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Doctors List</h1>

          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4">
          {activeTab === 'doctorsList' && (
            <button
              onClick={downloadCSV}
              className="bg-teal-50 hover:bg-teal-100 text-teal-700 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center gap-2 border border-teal-200 shadow-sm"
              title="Download Doctors List as CSV"
            >
              <Download size={16} strokeWidth={2.5} />
              <span className="hidden md:inline">Download CSV</span>
            </button>
          )}

          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer min-w-[200px]"
            value={selectedCamp}
            onChange={(e) => {
              setSelectedCamp(e.target.value);
              fetchCampDetails(e.target.value);
            }}
          >
            <option value="">Global / Select Camp...</option>
            {camps.map((c) => (
              <option key={c.id} value={c.id}>
                Camp #{c.number} — {c.venue}
              </option>
            ))}
          </select>

          <div className="relative group w-full md:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none w-full md:w-72 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'doctorsList'
            ? 'border-teal-500 text-teal-600'
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          onClick={() => setActiveTab('doctorsList')}
        >
          Doctors List
        </button>
        <button
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'analytics'
            ? 'border-teal-500 text-teal-600'
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          onClick={() => setActiveTab('analytics')}
        >
          Doctor Analytics
        </button>
        <button
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'registerDoctor'
            ? 'border-teal-500 text-teal-600'
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          onClick={() => setActiveTab('registerDoctor')}
        >
          Register Doctor
        </button>

      </div>

      {activeTab === 'doctorsList' && (
        <>
          {/* Table of Doctors */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                      <th className="p-4 pl-6">Doctor ID</th>
                      <th className="p-4">Doctor Name</th>
                      <th className="p-4">Specialization</th>
                      <th className="p-4">Actions</th>
                      <th className="p-4 pr-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDoctors.length > 0 ? (
                      filteredDoctors.map((doc, index) => {
                        const docKey = doc.dr_id || doc.dr_name;
                        const isEditing = editingId === docKey;

                        return (
                          <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                            {/* ID Column */}
                            <td className="p-4 pl-6 align-middle">
                              <span className="text-sm font-bold text-slate-600">
                                #{doc.dr_id || '-'}
                              </span>
                            </td>

                            {/* Name Column */}
                            <td className="p-4 align-middle">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.dr_name}
                                  onChange={(e) => setEditForm({ ...editForm, dr_name: e.target.value })}
                                  className="w-48 px-2 py-1.5 text-sm bg-white border border-teal-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                                />
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
                                    {doc.dr_name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-sm font-bold text-slate-800">
                                    {doc.dr_name}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Specialization Column */}
                            <td className="p-4 align-middle">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.specialization}
                                  onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                                  className="w-48 px-2 py-1.5 text-sm bg-white border border-teal-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                                />
                              ) : (
                                <span className="px-2.5 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                  {doc.specialization || 'Not Specified'}
                                </span>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="p-4 align-middle">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={handleSaveEdit}
                                    className="p-1.5 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors shadow-sm"
                                  >
                                    <Save size={16} />
                                  </button>
                                  <button onClick={handleCancelEdit} className="p-1.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200">
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditClick(doc)}
                                    className="p-2 bg-slate-100 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all active:scale-95 shadow-sm inline-flex items-center gap-2"
                                  >
                                    <Edit2 size={14} strokeWidth={2.5} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(doc.dr_id)}
                                    className="p-2 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95 shadow-sm"
                                    title="Delete Doctor"
                                  >
                                    <Trash2 size={14} strokeWidth={2.5} />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Status Column */}
                            <td className="p-4 pr-6 align-middle text-right">
                              <button
                                onClick={() => handleToggleStatus(doc.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 border ${
                                  doc.is_active 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                                    : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'
                                }`}
                                title={doc.is_active ? "Click to mark as inactive" : "Click to mark as active"}
                              >
                                {doc.is_active ? (
                                  <><CheckCircle2 size={12} /> Active</>
                                ) : (
                                  <><XCircle size={12} /> Inactive</>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-12 text-center text-slate-400">
                          No doctors registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}


      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Camp Selector removed from here as it's now in the header */}


          {analyticsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
            </div>
          ) : detailedData ? (
            <div className="space-y-6">
              {detailedData.doctors.map((dr, drIdx) => (
                <div key={drIdx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                   {/* Doctor Header */}
                   <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                            {dr.dr_name.charAt(0).toUpperCase()}
                         </div>
                         <div>
                            <h4 className="text-base font-black text-slate-800">{dr.dr_name || "Unknown Doctor"}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{dr.patients.length} Patients Attended</p>
                         </div>
                      </div>
                   </div>

                   {/* Patients Table */}
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-slate-50/30 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                              <th className="p-4 pl-6 w-1/4">Patient Name</th>
                              <th className="p-4 w-1/3">Medications Provided</th>
                              <th className="p-4 pr-6">Tests Recommended</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {dr.patients.map((p, pIdx) => (
                             <tr key={pIdx} className="hover:bg-slate-50/30 transition-colors">
                                <td className="p-4 pl-6 align-top">
                                   <span className="text-sm font-bold text-slate-700">{p.patient_name}</span>
                                </td>
                                <td className="p-4 align-top">
                                   <div className="flex flex-wrap gap-1.5">
                                      {p.medications.length > 0 ? p.medications.map((m, mIdx) => (
                                        <span key={mIdx} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-[10px] font-bold border border-teal-100">
                                          {m}
                                        </span>
                                      )) : <span className="text-[10px] text-slate-400 italic">No meds issued</span>}
                                   </div>
                                </td>
                                <td className="p-4 pr-6 align-top">
                                   <div className="flex flex-wrap gap-1.5">
                                      {p.tests.length > 0 ? p.tests.map((t, tIdx) => (
                                        <span key={tIdx} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100">
                                          {t}
                                        </span>
                                      )) : <span className="text-[10px] text-slate-400 italic">No tests ordered</span>}
                                   </div>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   </div>
                </div>
              ))}

              {detailedData.doctors.length === 0 && (
                 <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center">
                    <div className="p-4 bg-slate-50 rounded-full mb-4">
                      <Users className="text-slate-300" size={32} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800">No Patient Records</h3>
                    <p className="text-sm text-slate-500">No patients were recorded for this camp session.</p>
                 </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
               <p className="text-slate-400 font-bold">Select a camp to view detailed reports.</p>
            </div>
          )}
        </div>
      )}




      {activeTab === 'registerDoctor' && (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="max-w-md mx-auto">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                <Users className="text-teal-500" size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Register New Doctor</h2>
              <p className="text-slate-500 text-sm font-medium">Add medical staff to the database</p>
            </div>

            <form onSubmit={handleRegisterDoctor} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Doctor Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jane Smith"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                  value={newDr.name}
                  onChange={(e) => setNewDr({ ...newDr, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Specialization</label>
                <input
                  type="text"
                  placeholder="e.g. Cardiologist"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                  value={newDr.specialization}
                  onChange={(e) => setNewDr({ ...newDr, specialization: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-teal-100 flex items-center justify-center gap-2"
              >
                {regLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} strokeWidth={2.5} />
                    Register Doctor
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};

export default DoctorsList;
