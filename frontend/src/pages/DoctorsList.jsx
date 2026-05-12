import React, { useState, useEffect } from 'react';
import { UserCircle, Search, Users, Activity, Edit2, Save, X } from 'lucide-react';

const DoctorsList = () => {
  const [doctors, setDoctors] = useState([
    { dr_id: '', dr_name: '', specialization: '', patient_count: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('doctorsList');
  
  // Local state for editing
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ dr_name: '', dr_id: '', specialization: '' });



  const filteredDoctors = doctors.filter(doc => 
    doc.dr_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.dr_id && doc.dr_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

  const handleSaveEdit = () => {
    setDoctors(prevDoctors => prevDoctors.map(doc => {
      const docKey = doc.dr_id || doc.dr_name;
      if (docKey === editingId) {
        return {
          ...doc,
          dr_name: editForm.dr_name,
          dr_id: editForm.dr_id,
          specialization: editForm.specialization
        };
      }
      return doc;
    }));
    setEditingId(null);
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
            <p className="text-slate-500 text-sm font-medium">Manage and view medical staff performance</p>
          </div>
        </div>
        
        <div className="relative group">
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

      <div className="flex border-b border-slate-200">
        <button
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'doctorsList' 
              ? 'border-teal-500 text-teal-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('doctorsList')}
        >
          Doctors List
        </button>
        <button
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'newTab' 
              ? 'border-teal-500 text-teal-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('newTab')}
        >
          New Tab
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                      <th className="p-4 pl-6">Doctor ID</th>
                      <th className="p-4">Doctor Name</th>
                      <th className="p-4">Specialization</th>
                      <th className="p-4 pr-6 text-right"></th>
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
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.dr_id}
                                  onChange={(e) => setEditForm({...editForm, dr_id: e.target.value})}
                                  className="w-24 px-2 py-1.5 text-sm bg-white border border-teal-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                                />
                              ) : (
                                <span className="text-sm font-bold text-slate-600">
                                  {doc.dr_id || '-'}
                                </span>
                              )}
                            </td>

                            {/* Name Column */}
                            <td className="p-4 align-middle">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.dr_name}
                                  onChange={(e) => setEditForm({...editForm, dr_name: e.target.value})}
                                  className="w-48 px-2 py-1.5 text-sm bg-white border border-teal-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                                />
                              ) : (
                                <span className="text-sm font-bold text-slate-800">
                                  {doc.dr_name}
                                </span>
                              )}
                            </td>

                            {/* Specialization Column */}
                            <td className="p-4 align-middle">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.specialization}
                                  onChange={(e) => setEditForm({...editForm, specialization: e.target.value})}
                                  className="w-48 px-2 py-1.5 text-sm bg-white border border-teal-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                                />
                              ) : (
                                <span className="text-sm font-medium text-slate-600">
                                  {doc.specialization}
                                </span>
                              )}
                            </td>

                            {/* Actions Column (No Heading) */}
                            <td className="p-4 pr-6 align-middle text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={handleSaveEdit}
                                    className="p-1.5 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors shadow-sm"
                                    title="Save"
                                  >
                                    <Save size={16} />
                                  </button>
                                  <button 
                                    onClick={handleCancelEdit}
                                    className="p-1.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 hover:text-slate-700 transition-colors"
                                    title="Cancel"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleEditClick(doc)}
                                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                  title="Edit Details"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <UserCircle size={32} className="text-slate-300" />
                            <p className="font-medium">No doctors found matching your search.</p>
                          </div>
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

      {activeTab === 'newTab' && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-teal-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Activity className="text-teal-500" size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">New Tab Area</h3>
          <p className="text-slate-500 max-w-sm">This is an empty tab workspace. You can request to add new tables, charts, or forms here.</p>
        </div>
      )}

    </div>
  );
};

export default DoctorsList;
