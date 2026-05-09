import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ClipboardList, Landmark, Users, ChevronUp, ChevronDown, 
  Pill, FlaskConical, Search, X, Save
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

const CampPatients = () => {
  const [camps, setCamps] = useState([]);
  const [listCamp, setListCamp] = useState('');
  const [campPatients, setCampPatients] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/camps`).then(res => setCamps(res.data));
  }, []);

  const fetchCampPatients = async (campId) => {
    if (!campId) {
      setCampPatients([]);
      return;
    }
    setListLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/camp_patients/${campId}`);
      setCampPatients(res.data);
    } catch {
      setCampPatients([]);
    } finally {
      setListLoading(false);
    }
  };

  const handleUpdateTestRecord = async (testIssueId, newValue, patientId, tIndex) => {
    try {
      await axios.post(`${API_BASE}/update_test_record`, {
        test_issue_id: testIssueId,
        reports_issued: newValue
      });
      const newPatients = [...campPatients];
      const pIndex = newPatients.findIndex(p => p.patient_id === patientId);
      if (pIndex !== -1) {
        newPatients[pIndex].tests[tIndex].reports_issued = newValue;
        setCampPatients(newPatients);
      }
    } catch (err) {
      alert('Error updating record: ' + (err.response?.data?.message || err.message));
    }
  };





  const filteredPatients = campPatients.filter(pat => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return pat.patient_id.toString().includes(query) || 
           (pat.patient_name && pat.patient_name.toLowerCase().includes(query));
  });

  return (
    <div className="max-w-7xl mx-auto py-6">
      {/* ═══════════ CAMP WISE PATIENT LIST ═══════════ */}
      <div className="glass-panel-light p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400" />

        {/* Section title */}
        <div className="flex items-center gap-2 mb-6">
          <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-100">
            <ClipboardList size={16} className="text-blue-600" strokeWidth={2.5} />
          </div>
          <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">Camp Wise Patient List</h4>
        </div>

        {/* Camp Selector */}
        <div className="mb-6 p-5 bg-slate-50/50 border border-slate-100 rounded-2xl">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
            <Landmark size={14} className="text-blue-500" />
            Select Target Camp...
          </label>
          <select
            className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
            value={listCamp}
            onChange={e => {
              setListCamp(e.target.value);
              setExpandedPatient(null);
              setSearchQuery('');
              fetchCampPatients(e.target.value);
            }}
          >
            <option value="">Select Target Camp...</option>
            {camps.map(camp => (
              <option key={camp.id} value={camp.id}>
                {camp.venue} • Camp {camp.number} ({camp.date})
              </option>
            ))}
          </select>

          {/* Search Bar */}
          {listCamp && campPatients.length > 0 && (
            <div className="mt-4 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={2.5} />
              <input
                type="text"
                placeholder="Search by Patient ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-5 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          )}
        </div>

        {/* Loading */}
        {listLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        {/* No patients */}
        {!listLoading && listCamp && campPatients.length === 0 && (
          <div className="text-center py-16">
            <Users size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">No patients found for this camp</p>
          </div>
        )}

        {/* No search results */}
        {!listLoading && listCamp && campPatients.length > 0 && filteredPatients.length === 0 && (
          <div className="text-center py-16">
            <Search size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">No patients match your search query</p>
          </div>
        )}

        {/* Patient count badge */}
        {!listLoading && filteredPatients.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full border border-blue-100">
              {filteredPatients.length} {filteredPatients.length === 1 ? 'Patient' : 'Patients'}
            </span>
          </div>
        )}

        {/* Patient Cards */}
        {!listLoading && filteredPatients.length > 0 && (
          <div className="space-y-3">
            {filteredPatients.map((pat, idx) => {
              const isExpanded = expandedPatient === idx;
              return (
                <div
                  key={idx}
                  className={`border rounded-2xl transition-all overflow-hidden ${
                    isExpanded
                      ? 'border-blue-300 shadow-md shadow-blue-50 bg-white'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                  }`}
                >
                  {/* Patient Header (clickable) */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                    onClick={() => setExpandedPatient(isExpanded ? null : idx)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${
                        isExpanded
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`} >
                        {pat.patient_id}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">
                          {pat.patient_name || <span className="text-slate-400 italic">No Name</span>}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Patient ID: {pat.patient_id}
                          {pat.medicines.length > 0 && <span className="ml-2">• {pat.medicines.length} medicine{pat.medicines.length !== 1 && 's'}</span>}
                          {pat.tests.length > 0 && <span className="ml-2">• {pat.tests.length} test{pat.tests.length !== 1 && 's'}</span>}
                        </p>
                      </div>
                    </div>
                    <div className={`p-1.5 rounded-lg transition-all ${
                      isExpanded ? 'bg-blue-100 text-blue-600' : 'text-slate-300'
                    }`}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 border-t border-slate-100">
                      
                      {/* Patient Info Row */}
                      <div className="flex items-center justify-between mt-3 mb-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex gap-6 text-xs font-bold text-slate-600">
                          <div><span className="text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">Age</span>{pat.age || '—'}</div>
                          <div><span className="text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">Gender</span>{pat.gender || '—'}</div>
                          <div><span className="text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">Contact</span>{pat.contact || '—'}</div>
                          <div><span className="text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">Reg Date</span>{pat.registered_date || '—'}</div>
                          <div><span className="text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">Address</span>{pat.address || '—'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">

                        {/* Medicines */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1 bg-emerald-50 rounded-md border border-emerald-100">
                              <Pill size={12} className="text-emerald-600" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medicines Issued</span>
                          </div>
                          {pat.medicines.length === 0 ? (
                            <p className="text-xs text-slate-300 font-bold italic pl-1">No medicines issued</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-200">
                                    <th className="px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] w-16 text-center">M.ID</th>
                                    <th className="px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">Medicine Name</th>
                                    <th className="px-3 py-2.5 text-[9px] font-black text-emerald-600 uppercase tracking-[0.15em] w-16 text-center">Qty</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {pat.medicines.map((med, mi) => (
                                    <tr key={mi} className="hover:bg-emerald-50/30 transition-colors">
                                      <td className="px-3 py-2 text-center">
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100">
                                          {med.medicine_id}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-xs font-bold text-slate-700">{med.medicine_name}</td>
                                      <td className="px-3 py-2 text-center">
                                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-black border border-emerald-100">
                                          {med.quantity}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Tests */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1 bg-purple-50 rounded-md border border-purple-100">
                              <FlaskConical size={12} className="text-purple-600" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lab Tests Issued</span>
                          </div>
                          {pat.tests.length === 0 ? (
                            <p className="text-xs text-slate-300 font-bold italic pl-1">No tests issued</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gradient-to-r from-slate-50 to-purple-50/30 border-b border-slate-200">
                                    <th className="px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] w-16 text-center">T.ID</th>
                                    <th className="px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">Test Name</th>
                                    <th className="px-3 py-2.5 text-[9px] font-black text-purple-600 uppercase tracking-[0.15em] w-28 text-center">Reports Issued</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {pat.tests.map((t, ti) => (
                                    <tr key={ti} className="hover:bg-purple-50/30 transition-colors">
                                      <td className="px-3 py-2 text-center">
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-purple-50 text-purple-700 text-[10px] font-black border border-purple-100">
                                          {t.test_id}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-xs font-bold text-slate-700">{t.test_name}</td>
                                      <td className="px-3 py-2 text-center">
                                        <input 
                                          type="checkbox" 
                                          className="w-4 h-4 accent-purple-600 cursor-pointer"
                                          checked={t.reports_issued || false}
                                          onChange={(e) => handleUpdateTestRecord(t.test_issue_id, e.target.checked, pat.patient_id, ti)}
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Placeholder when no camp is selected */}
        {!listCamp && (
          <div className="text-center py-16">
            <Search size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">Select a camp to view patient records</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default CampPatients;
