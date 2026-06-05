import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pill, Search, Download, PackageOpen, Filter, Box, Heart, Check, X, AlertTriangle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`;

const Inventory = () => {
  const [medicines, setMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUqid, setEditingUqid] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/medicines`).then(res => {
      setMedicines(res.data);
      setLoading(false);
    });
  }, []);

  const filteredMeds = medicines.filter(m => {
    const searchTerms = searchTerm.toLowerCase().trim().split(/\s+/);
    const searchableText = `${m.name} ${m.formulation || ''} ${m.category || ''} ${m.uqid}`.toLowerCase();
    const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));
    const matchesCategory = selectedCategory ? m.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const sortedMeds = [...filteredMeds].sort((a, b) => Number(a.uqid) - Number(b.uqid));

  const groupedMeds = sortedMeds.reduce((acc, med) => {
    const cat = med.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(med);
    return acc;
  }, {});

  const getCategoryOrderKey = (catName) => {
    const rangeMatch = catName.match(/\((\d+)/);
    if (rangeMatch) return parseInt(rangeMatch[1], 10);
    const letterMatch = catName.match(/\s+-\s+([A-Z])\b/);
    if (letterMatch) return letterMatch[1].charCodeAt(0);
    return 9999;
  };

  const sortedCategories = Object.keys(groupedMeds).sort((a, b) => {
    const keyA = getCategoryOrderKey(a);
    const keyB = getCategoryOrderKey(b);
    if (keyA !== keyB) return keyA - keyB;
    return a.localeCompare(b);
  });

  const availableCategories = Array.from(new Set(medicines.map(m => m.category).filter(Boolean)));
  const sortedFilterCategories = [...availableCategories].sort((a, b) => {
    const keyA = getCategoryOrderKey(a);
    const keyB = getCategoryOrderKey(b);
    if (keyA !== keyB) return keyA - keyB;
    return a.localeCompare(b);
  });

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
          className="flex justify-center w-full md:w-auto items-center gap-3 bg-white hover:bg-slate-50 text-slate-700 px-8 py-4 rounded-xl border border-slate-200 hover:border-teal-200 transition-all shadow-sm font-bold text-sm"
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
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`p-4 rounded-xl border transition-all flex items-center gap-2 ${
                selectedCategory
                  ? 'bg-teal-50 border-teal-300 text-teal-600 font-bold'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-200'
              }`}
            >
              <Filter size={20} strokeWidth={2.5} />
              {selectedCategory && (
                <span className="text-xs truncate max-w-[150px] text-teal-700 bg-teal-100/50 px-2 py-0.5 rounded border border-teal-200">
                  {selectedCategory.split(' - ')[0]}
                </span>
              )}
            </button>

            {showFilterDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilterDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 animate-fade-in max-h-[400px] overflow-y-auto">
                  <div className="px-4 py-2 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Filter by Category
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs font-bold transition-all border-l-2 flex justify-between items-center ${
                      selectedCategory === null
                        ? 'bg-teal-50 border-teal-500 text-teal-700'
                        : 'border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>All Categories</span>
                    {selectedCategory === null && <Check size={14} strokeWidth={3} className="text-teal-500" />}
                  </button>
                  {sortedFilterCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold transition-all border-l-2 flex justify-between items-center ${
                        selectedCategory === cat
                          ? 'bg-teal-50/50 border-teal-500 text-teal-700'
                          : 'border-transparent text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {selectedCategory === cat && <Check size={14} strokeWidth={3} className="text-teal-500" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-8 py-5">Identity (UQID)</th>
                <th className="px-8 py-5">Medication Description</th>
                <th className="px-8 py-5 text-right">Available Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="3" className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-400">
                      <div className="h-8 w-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                      <span className="font-extrabold uppercase tracking-widest text-xs">Syncing Repository...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMeds.length > 0 ? (
                sortedCategories.map((categoryName) => (
                  <React.Fragment key={categoryName}>
                    <tr className="bg-slate-100/60 border-y border-slate-200">
                      <td colSpan="3" className="px-8 py-3.5">
                        <div className="flex items-center justify-center gap-3">
                          <span className="font-extrabold text-[11px] text-teal-800 uppercase tracking-[0.2em] font-sans">
                            {categoryName}
                          </span>
                          <span className="bg-teal-50 text-teal-700 text-[10px] font-black px-3 py-1 rounded-full border border-teal-100/50">
                            {groupedMeds[categoryName].length} {groupedMeds[categoryName].length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {groupedMeds[categoryName].map((med) => (
                      <tr key={med.uqid} className="hover:bg-teal-50/40 transition-all group">
                        <td className="px-8 py-6">
                          <span className="font-data text-sm text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
                            #{med.uqid}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-between gap-6">
                            <span className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors">{med.name}</span>
                            <span className="text-xs text-slate-600 font-bold italic bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                              {med.formulation || 'No formulation specified'}
                            </span>
                          </div>
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
                                  className={`h-full rounded-full transition-all ${med.stock >= 50 ? 'bg-red-500' : 'bg-emerald-500'}`}
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
                  <td colSpan="3" className="px-8 py-32 text-center">
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
