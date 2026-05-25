import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pill, Search, Download, PackageOpen, Filter, Box, Heart, Check, X, AlertTriangle } from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:8000/api`;

const Inventory = () => {
  const [medicines, setMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUqid, setEditingUqid] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/medicines`).then(res => {
      setMedicines(res.data);
      setLoading(false);
    });
  }, []);

  const filteredMeds = medicines.filter(m => {
    const searchTerms = searchTerm.toLowerCase().trim().split(/\s+/);
    if (searchTerms.length === 0) return true;

    const searchableText = `${m.name} ${m.formulation || ''} ${m.category || ''} ${m.uqid}`.toLowerCase();
    return searchTerms.every(term => searchableText.includes(term));
  });

  const groupedMeds = filteredMeds.reduce((acc, med) => {
    const category = med.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(med);
    return acc;
  }, {});

  const handleExport = () => {
    window.location.href = 'http://localhost:8000/export';
  };

  const startEdit = (med) => {
    setEditingUqid(med.uqid);
    setEditValue(String(med.stock));
  };

  const cancelEdit = () => {
    setEditingUqid(null);
    setEditValue('');
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveStock = async (uqid) => {
    const newStock = parseInt(editValue, 10);
    if (isNaN(newStock) || newStock < 0) {
      showToast('Please enter a valid number (0 or above)', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}/set_stock`, {
        uqid: uqid,
        stock: newStock
      });

      if (res.data.status === 'success') {
        // Update the local state
        setMedicines(prev =>
          prev.map(m => m.uqid === uqid ? { ...m, stock: newStock } : m)
        );
        showToast(`${res.data.medicine_name} stock updated to ${newStock}`);
        setEditingUqid(null);
        setEditValue('');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update stock';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e, uqid) => {
    if (e.key === 'Enter') saveStock(uqid);
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-lg border font-bold text-sm flex items-center gap-3 animate-fade-in ${toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
          }`}>
          {toast.type === 'success' ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Heart size={14} className="text-teal-500" />
            <p className="text-teal-600 text-[10px] font-extrabold uppercase tracking-[0.25em]">Pharmacy Management</p>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200">
              <Box className="text-teal-600" size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Stock Inventory</h3>
          </div>
          <p className="text-slate-400 text-sm font-bold ml-[52px]">Central Pharmacy Repository &mdash; Click stock value to edit</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-700 px-8 py-4 rounded-xl border border-slate-200 hover:border-teal-200 transition-all shadow-sm font-bold text-sm"
        >
          <Download size={20} className="text-teal-500" strokeWidth={2.5} />
          Download Stock Audit (.CSV)
        </button>
      </div>

      <div className="glass-panel-light overflow-hidden relative">
        {/* Accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400" />

        {/* Search */}
        <div className="p-8 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search by name, formulation, category or UQID (e.g. 'Tablet 500')..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-14 pr-12 py-4 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all font-bold"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <div className="bg-slate-100 rounded-full p-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
              </button>
            )}
          </div>
          <button className="p-4 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-teal-600 hover:border-teal-200 transition-all">
            <Filter size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
                <th className="px-8 py-5">Identity (UQID)</th>
                <th className="px-8 py-5">Medication Description</th>
                <th className="px-8 py-5">Formulation</th>
                <th className="px-8 py-5 text-right">Available Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-400">
                      <div className="h-8 w-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                      <span className="font-extrabold uppercase tracking-widest text-xs">Syncing Repository...</span>
                    </div>
                  </td>
                </tr>
              ) : Object.keys(groupedMeds).length > 0 ? (
                Object.entries(groupedMeds).map(([category, meds]) => (
                  <React.Fragment key={category}>
                    <tr>
                      <td colSpan="4" className="bg-slate-200 px-8 py-3 font-black text-slate-800 uppercase tracking-[0.2em] text-xs border-y-2 border-slate-300 shadow-sm text-center">
                        {category}
                      </td>
                    </tr>
                    {meds.map((med) => (
                      <tr key={med.uqid} className="hover:bg-teal-50/40 transition-all group">
                        <td className="px-8 py-6">
                          <span className="font-data text-sm text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
                            #{med.uqid}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <span className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors text-base">{med.name}</span>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-base font-bold text-slate-700">
                            {med.formulation || '—'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {editingUqid === med.uqid ? (
                            /* Editing mode */
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, med.uqid)}
                                onBlur={() => saveStock(med.uqid)}
                                className="w-24 text-right text-lg font-black font-data bg-white border-2 border-teal-400 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500/30"
                                disabled={saving}
                              />
                              <button
                                onMouseDown={(e) => e.preventDefault()} // Prevent blur from firing before click
                                onClick={() => saveStock(med.uqid)}
                                disabled={saving}
                                className="p-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all disabled:opacity-50"
                                title="Save"
                              >
                                <Check size={16} strokeWidth={3} />
                              </button>
                              <button
                                onMouseDown={(e) => e.preventDefault()} // Prevent blur from firing before click
                                onClick={cancelEdit}
                                disabled={saving}
                                className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition-all disabled:opacity-50"
                                title="Cancel"
                              >
                                <X size={16} strokeWidth={3} />
                              </button>
                            </div>
                          ) : (
                            /* Display mode */
                            <div className="flex flex-col items-end cursor-pointer" onClick={() => startEdit(med)}>
                              <div className="flex items-center gap-2">
                                {med.stock < 50 && (
                                  <AlertTriangle size={18} strokeWidth={2.5} className="text-red-500 animate-pulse" title="Low Stock Alert" />
                                )}
                                <span className={`text-xl font-black font-data ${med.stock >= 50 ? 'text-slate-800' : 'text-red-500'}`}>
                                  {med.stock}
                                </span>
                              </div>
                              <div className={`h-1.5 w-14 rounded-full mt-2 ${med.stock >= 50 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                <div
                                  className={`h-full rounded-full transition-all ${med.stock >= 50 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(med.stock, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 animate-fade-in">
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 mb-2">
                        <PackageOpen size={60} strokeWidth={1} className="text-slate-300" />
                      </div>
                      <h4 className="text-xl font-extrabold text-slate-400">Inventory Empty</h4>
                      <p className="text-sm max-w-xs mx-auto font-bold text-slate-400">The search query did not match any medicinal records in the central repository.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
