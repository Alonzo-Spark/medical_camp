import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pill, Search, PackageOpen, Filter, Box, PlusCircle, CheckCircle2, Heart, Landmark, RefreshCcw, AlertTriangle, Download, Edit3, Check, X } from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:8000/api`;

const MedicineEntry = () => {
  const [medicines, setMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updateQtys, setUpdateQtys] = useState({}); // To store input values for each med {uqid: value}
  const [successMsg, setSuccessMsg] = useState('');
  const [viewMode, setViewMode] = useState('total'); // 'total' or 'camp'
  const [campStocks, setCampStocks] = useState([]);
  const [allocateQtys, setAllocateQtys] = useState({});
  const [detailsForm, setDetailsForm] = useState({});
  const [camps, setCamps] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMed, setNewMed] = useState({ uqid: '', name: '', formulation: '', stock: '', cost: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingMedId, setEditingMedId] = useState(null);
  const [editMedData, setEditMedData] = useState({ uqid: '', name: '', cost: '' });
  const [campUnitCosts, setCampUnitCosts] = useState({});
  const [editingUqid, setEditingUqid] = useState(null);
  const [tempAltName, setTempAltName] = useState('');



  useEffect(() => {
    fetchMedicines();
    fetchCamps();
  }, []);

  useEffect(() => {
    fetchCampStocks();
  }, [selectedCamp, medicines]);

  const fetchCamps = () => {
    axios.get(`${API_BASE}/camps`).then(res => {
      setCamps(res.data);
    });
  };

  const fetchMedicines = () => {
    setLoading(true);
    return axios.get(`${API_BASE}/medicines`).then(res => {
      setMedicines(res.data);
      setLoading(false);
      return res.data;
    });
  };

  const fetchCampStocks = () => {
    if (!selectedCamp) {
      setCampStocks([]);
      return;
    }
    axios.get(`${API_BASE}/camp_stock/${selectedCamp}`).then(res => {
      // Map over all medicines to ensure every medicine appears in the camp-wise view
      const stocksArray = medicines.map(med => {
        const campData = res.data[med.uqid] || { allocated: 0, used: 0, returned: 0, remaining: 0, unit_cost: null, alternate_name: '', company_name: '', expiry_date: '' };
        return {
          uqid: med.uqid,
          medication: med.name,
          formulation: med.formulation || '',
          total_stock: med.stock,
          camp_stock: campData.allocated,
          used_stock: campData.used,
          returned_stock: campData.returned || 0,
          remaining_stock: Math.max(0, campData.remaining || 0),
          unit_cost: campData.unit_cost !== undefined && campData.unit_cost !== null ? campData.unit_cost : (med.cost || 0),
          alternate_name: campData.alternate_name || '',
          company_name: campData.company_name || '',
          expiry_date: campData.expiry_date || ''
        };
      });
      setCampStocks(stocksArray);
    });
  };

  const handleQtyChange = (uqid, value) => {
    setUpdateQtys(prev => ({ ...prev, [uqid]: value }));
  };

  const handleAllocateQtyChange = (uqid, value) => {
    setAllocateQtys(prev => ({ ...prev, [uqid]: value }));
  };

  const handleUpdate = async (uqid) => {
    const qty = parseInt(updateQtys[uqid]);
    if (isNaN(qty) || qty <= 0) return;

    try {
      const res = await axios.post(`${API_BASE}/update_stock`, {
        uqid: uqid,
        added_qty: qty
      });

      setSuccessMsg(`Successfully added ${qty} units to ${res.data.medicine_name}`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setUpdateQtys(prev => ({ ...prev, [uqid]: '' }));
      setMedicines(prev => prev.map(m => m.uqid === uqid ? { ...m, stock: res.data.new_stock } : m));
      // Sync camp stocks view too
      setCampStocks(prev => prev.map(s => s.uqid === uqid ? { ...s, total_stock: res.data.new_stock } : s));
    } catch (err) {
      alert('Error updating stock: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSetStock = async (uqid) => {
    const qty = parseInt(updateQtys[uqid]);
    if (isNaN(qty) || qty < 0) {
      alert('Please enter a valid number (0 or above)');
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/set_stock`, {
        uqid: uqid,
        stock: qty
      });

      setSuccessMsg(`Successfully set ${res.data.medicine_name} stock to ${qty}`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setUpdateQtys(prev => ({ ...prev, [uqid]: '' }));
      setMedicines(prev => prev.map(m => m.uqid === uqid ? { ...m, stock: res.data.new_stock } : m));
      // Sync camp stocks view too
      setCampStocks(prev => prev.map(s => s.uqid === uqid ? { ...s, total_stock: res.data.new_stock } : s));
    } catch (err) {
      alert('Error setting stock: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleAllocate = async (uqid) => {
    const qty = parseInt(allocateQtys[uqid]);
    if (!qty || qty <= 0) return;

    try {
      const res = await axios.post(`${API_BASE}/allocate_to_camp`, {
        uqid: uqid,
        qty: qty,
        camp_id: selectedCamp
      });

      setSuccessMsg(`Allocated ${qty} units of ${res.data.medicine_name} to Camp`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setAllocateQtys(prev => ({ ...prev, [uqid]: '' }));

      // Update both views
      setMedicines(prev => prev.map(m => m.uqid === uqid ? { ...m, stock: res.data.new_total_stock } : m));
      fetchCampStocks(); // Refresh to get correct used/remaining
    } catch (err) {
      alert('Error allocating stock: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleReturnAll = async () => {
    if (!selectedCamp) return;
    
    const stocksToReturn = campStocks.filter(s => s.remaining_stock > 0);
    if (stocksToReturn.length === 0) {
      alert("No available balance to update for this camp.");
      return;
    }

    if (!window.confirm(`Are you sure you want to update the total stock by adding the available balance for ALL ${stocksToReturn.length} medications in this camp?`)) {
      return;
    }

    setSuccessMsg('Updating all balances...');
    
    try {
      for (const stock of stocksToReturn) {
        await axios.post(`${API_BASE}/return_to_warehouse`, {
          med_id: stock.uqid,
          camp_id: selectedCamp
        });
      }

      setSuccessMsg(`Successfully updated all balances!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchMedicines();
      fetchCampStocks();
    } catch (err) {
      alert('Error updating some stocks: ' + (err.response?.data?.message || err.message));
      fetchMedicines();
      fetchCampStocks();
    }
  };

  const handleReturn = async (uqid, medName, remainingStock) => {
    if (!selectedCamp) return;
    
    if (!window.confirm(`Are you sure you want to update the total stock by adding the available balance of ${remainingStock} units for ${medName}?`)) {
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/return_to_warehouse`, {
        med_id: uqid,
        camp_id: selectedCamp
      });

      setSuccessMsg(`Stock returned to warehouse`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchMedicines();
      fetchCampStocks();
    } catch (err) {
      alert('Error returning stock: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDetailsChange = (uqid, field, value) => {
    setDetailsForm(prev => ({
      ...prev,
      [uqid]: {
        ...prev[uqid],
        [field]: value
      }
    }));
  };

  const handleSaveDetails = async (uqid) => {
    const medDetails = detailsForm[uqid] || {};
    const med = medicines.find(m => m.uqid === uqid);
    const campStock = campStocks.find(s => s.uqid === uqid);

    const cost = medDetails.cost !== undefined ? medDetails.cost : med.cost;
    const company = medDetails.company_name !== undefined ? medDetails.company_name : (selectedCamp && campStock ? campStock.company_name : (med.company_name || ''));
    const expiry = medDetails.expiry_date !== undefined ? medDetails.expiry_date : (selectedCamp && campStock ? campStock.expiry_date : (med.expiry_date || ''));

    try {
      if (selectedCamp) {
        // Save camp-wise details
        await axios.post(`${API_BASE}/update_camp_medicine_details`, {
          camp_id: selectedCamp,
          uqid: uqid,
          company_name: company,
          expiry_date: expiry
        });

        // Also save cost globally as cost/unit_cost updates
        await axios.post(`${API_BASE}/update_medicine_details`, {
          uqid: uqid,
          cost: cost,
          company_name: med.company_name, // Keep global intact
          expiry_date: med.expiry_date    // Keep global intact
        });
      } else {
        // Save globally
        await axios.post(`${API_BASE}/update_medicine_details`, {
          uqid: uqid,
          cost: cost,
          company_name: company,
          expiry_date: expiry
        });
      }

      setSuccessMsg("Details saved successfully");
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchMedicines().then(updatedMeds => {
        fetchCampStocks(updatedMeds);
      });
    } catch (err) {
      alert('Error updating details: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveEdit = async (oldUqid) => {
    const { uqid, name, cost, formulation } = editMedData;
    if (!name || !name.trim()) {
      alert('Medicine name is required');
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/update_medicine_profile`, {
        old_uqid: oldUqid,
        new_uqid: parseInt(uqid),
        name: name,
        cost: cost !== '' && cost !== null ? parseFloat(cost) : null,
        formulation: formulation !== '' && formulation !== null ? formulation : null
      });

      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 3000);
      setEditingMedId(null);
      fetchMedicines().then(updatedMeds => {
        fetchCampStocks(updatedMeds);
      });
    } catch (err) {
      alert('Error updating details: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCampUnitCostChange = (uqid, value) => {
    setCampUnitCosts(prev => ({ ...prev, [uqid]: value }));
  };

  const handleSaveCampUnitCost = async (uqid) => {
    const value = campUnitCosts[uqid];
    if (value === undefined) return;

    try {
      const res = await axios.post(`${API_BASE}/update_camp_unit_cost`, {
        camp_id: selectedCamp,
        uqid: uqid,
        unit_cost: value !== '' ? parseFloat(value) : null
      });

      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 1500);
      fetchCampStocks();
    } catch (err) {
      alert('Error updating camp unit cost: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveAlternateName = async (uqid) => {
    try {
      const res = await axios.post(`${API_BASE}/update_camp_alternate_name`, {
        camp_id: selectedCamp,
        uqid: uqid,
        alternate_name: tempAltName.trim() || null
      });

      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 1500);
      setEditingUqid(null);
      fetchCampStocks();
    } catch (err) {
      alert('Error updating camp alternate name: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    if (!newMed.name) {
      alert('Medicine name is required');
      return;
    }
    setIsAdding(true);
    try {
      const res = await axios.post(`${API_BASE}/add_medicine`, {
        uqid: newMed.uqid,
        name: newMed.name,
        formulation: newMed.formulation,
        stock: parseInt(newMed.stock) || 0,
        cost: newMed.cost !== '' ? parseFloat(newMed.cost) : null
      });

      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 3000);
      setNewMed({ uqid: '', name: '', formulation: '', stock: '', cost: '' });
      setShowAddForm(false);
      fetchMedicines().then(updatedMeds => {
        fetchCampStocks(updatedMeds);
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setIsAdding(false);
    }

  };


  const handleExportCampStock = () => {
    if (!selectedCamp) return;
    window.location.href = `http://localhost:8000/export_camp_stock/${selectedCamp}`;
  };

  const filteredMeds = medicines.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.uqid.toString().includes(searchTerm)
  ).sort((a, b) => Number(a.uqid) - Number(b.uqid));

  const filteredCampStocks = campStocks.filter(s =>
    s.medication.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.uqid.toString().includes(searchTerm)
  ).sort((a, b) => Number(a.uqid) - Number(b.uqid));

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Heart size={14} className="text-teal-500" />
            <p className="text-teal-600 text-[10px] font-extrabold uppercase tracking-[0.25em]">Stock Management</p>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200">
              <PlusCircle className="text-teal-600" size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Inventory Replenishment</h3>
          </div>
          <p className="text-slate-400 text-sm font-bold ml-[52px]">Digital Pharmacy Stock Intake</p>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-200 shadow-sm animate-bounce">
            <CheckCircle2 size={18} strokeWidth={3} />
            <span className="text-xs font-black uppercase tracking-widest">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-6 py-3 rounded-xl border border-rose-200 shadow-sm animate-shake">
            <AlertTriangle size={18} strokeWidth={3} />
            <span className="text-xs font-black uppercase tracking-widest">{errorMsg}</span>
          </div>
        )}
      </div>


      {/* View Switcher */}
      <div className="flex gap-4 px-4">
        <button
          onClick={() => setViewMode('total')}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${viewMode === 'total'
            ? 'bg-teal-600 text-white shadow-xl shadow-teal-100 scale-[1.02]'
            : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50 hover:text-slate-600'
            }`}
        >
          <Box size={18} strokeWidth={2.5} />
          Total Stock Entry
        </button>
        <button
          onClick={() => setViewMode('camp')}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${viewMode === 'camp'
            ? 'bg-teal-600 text-white shadow-xl shadow-teal-100 scale-[1.02]'
            : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50 hover:text-slate-600'
            }`}
        >
          <Landmark size={18} strokeWidth={2.5} />
          Camp Wise Entry
        </button>
        <button
          onClick={() => setViewMode('details')}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${viewMode === 'details'
            ? 'bg-teal-600 text-white shadow-xl shadow-teal-100 scale-[1.02]'
            : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50 hover:text-slate-600'
            }`}
        >
          <Pill size={18} strokeWidth={2.5} />
          Medicine Details
        </button>

        {(viewMode === 'camp' || viewMode === 'details') && (
          <div className="flex flex-1 items-center gap-4 animate-in fade-in slide-in-from-left-4">
            <select
              className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-600 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer"
              value={selectedCamp}
              onChange={e => setSelectedCamp(e.target.value)}
            >
              <option value="">Select Camp</option>
              {camps.map(camp => (
                <option key={camp.id} value={camp.id}>
                  {camp.venue} • Camp {camp.number}
                </option>
              ))}
            </select>

            {selectedCamp && viewMode === 'camp' && (
              <div className="flex gap-4 animate-in fade-in zoom-in">
                <button
                  onClick={handleReturnAll}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-2xl shadow-sm shadow-teal-100 font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  <RefreshCcw size={16} strokeWidth={3} />
                  Update All Balances
                </button>
                <button
                  onClick={handleExportCampStock}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 text-teal-600 px-6 py-4 rounded-2xl border border-teal-100 hover:border-teal-300 transition-all shadow-sm font-black text-[10px] uppercase tracking-widest"
                >
                  <Download size={16} strokeWidth={3} />
                  Export CSV
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-panel-light overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400" />

        {/* Shared Search Bar */}
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} strokeWidth={2.5} />
            <input
              type="text"
              placeholder={`Search ${viewMode === 'total' ? 'main inventory' : 'camp stocks'} by name or UQID...`}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-6 py-4 text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all font-bold shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {viewMode === 'total' && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${showAddForm
                  ? 'bg-rose-600 text-white'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
                  } shadow-lg`}
              >
                {showAddForm ? 'Cancel' : (
                  <>
                    <PlusCircle size={18} strokeWidth={2.5} />
                    New Medicine
                  </>
                )}
              </button>
            )}
            <button onClick={() => { fetchMedicines(); fetchCampStocks(); }} className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm">
              <Filter size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {showAddForm && viewMode === 'total' && (
          <div className="p-8 bg-teal-50/30 border-b border-slate-100 animate-in slide-in-from-top-4 duration-300">
            <form onSubmit={handleAddMedicine} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">UQID (Optional)</label>
                <input
                  type="number"
                  placeholder="Auto-gen"
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={newMed.uqid}
                  onChange={e => setNewMed({ ...newMed, uqid: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Medicine Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol"
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={newMed.name}
                  onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Formulation</label>
                <input
                  type="text"
                  placeholder="e.g. 500mg Tablet"
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={newMed.formulation}
                  onChange={e => setNewMed({ ...newMed, formulation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initial Stock</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={newMed.stock}
                  onChange={e => setNewMed({ ...newMed, stock: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unit Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={newMed.cost}
                  onChange={e => setNewMed({ ...newMed, cost: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={isAdding}
                className="w-full bg-slate-800 text-white h-[46px] rounded-xl font-black text-[11px] uppercase tracking-[0.15em] hover:bg-slate-900 transition-all disabled:opacity-50 shadow-md"
              >
                {isAdding ? 'Registering...' : 'Register Medicine'}
              </button>
            </form>
          </div>
        )}



        {viewMode === 'total' ? (
          /* Total Stock View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[12px] font-black uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-4 max-w-[130px] leading-snug">System Identity (UQID)</th>
                  <th className="px-4 py-4">Medication Description</th>
                  <th className="px-4 py-4">Unit Cost (₹)</th>
                  <th className="px-4 py-4">Total Cost (₹)</th>
                  <th className="px-4 py-4 max-w-[130px] leading-snug">Global Inventory Status</th>
                  <th className="px-4 py-4 text-right max-w-[130px] leading-snug">Add to Global Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin" />
                        <span className="font-black uppercase tracking-widest text-[10px] text-slate-400">Syncing Repository...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMeds.length > 0 ? (
                  filteredMeds.map((med) => (
                    <tr key={med.uqid} className="hover:bg-teal-50/40 transition-all group">
                      <td className="px-4 py-4">
                        {editingMedId === med.uqid ? (
                          <input
                            type="text"
                            className="w-full max-w-[100px] bg-white border border-teal-300 rounded-lg px-2 py-1.5 text-sm font-data outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                            value={editMedData.uqid}
                            onChange={(e) => setEditMedData({ ...editMedData, uqid: e.target.value })}
                          />
                        ) : (
                          <span className="font-data text-sm font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
                            #{med.uqid}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editingMedId === med.uqid ? (
                          <div className="flex flex-col gap-1 max-w-md">
                            <input
                              type="text"
                              className="w-full bg-white border border-teal-300 rounded-lg px-2 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                              value={editMedData.name}
                              onChange={(e) => setEditMedData({ ...editMedData, name: e.target.value })}
                            />
                            <input
                              type="text"
                              className="w-full bg-white border border-teal-300 rounded-lg px-2 py-1 text-xs font-extrabold outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm mt-1 uppercase"
                              placeholder="Formulation (e.g. TABLET)"
                              value={editMedData.formulation || ''}
                              onChange={(e) => setEditMedData({ ...editMedData, formulation: e.target.value })}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 max-w-md">
                            <span className="text-base font-black text-slate-800 group-hover:text-teal-700 transition-colors truncate">{med.name}</span>
                            <span className="text-xs text-slate-600 font-extrabold uppercase tracking-wider px-2 py-0.5 bg-slate-50 rounded-md border border-slate-100 truncate">
                              {med.formulation || 'Generic Formulation'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editingMedId === med.uqid ? (
                          <input
                            type="number"
                            step="0.01"
                            className="w-full max-w-[100px] bg-white border border-teal-300 rounded-lg px-2 py-1.5 text-sm font-data outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                            value={editMedData.cost !== undefined ? editMedData.cost : ''}
                            onChange={(e) => setEditMedData({ ...editMedData, cost: e.target.value })}
                          />
                        ) : (
                          <span className="font-data text-sm font-bold text-slate-600">
                            {med.cost ? `₹ ${parseFloat(med.cost).toFixed(2)}` : '₹ 0.00'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-data text-sm font-black text-slate-800">
                          {editingMedId === med.uqid ? (
                            editMedData.cost && !isNaN(parseFloat(editMedData.cost))
                              ? `₹ ${(parseFloat(editMedData.cost) * med.stock).toFixed(2)}`
                              : '₹ 0.00'
                          ) : (
                            med.cost ? `₹ ${(parseFloat(med.cost) * med.stock).toFixed(2)}` : '₹ 0.00'
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className={`text-xl font-black font-data ${med.stock > 10 ? 'text-slate-800' : 'text-rose-600'}`}>
                            {med.stock}
                          </span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Available Units</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="relative">
                            <input
                              type="number"
                              placeholder="0"
                              className="w-24 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-black text-center focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all placeholder:text-slate-200 shadow-sm"
                              value={updateQtys[med.uqid] !== undefined ? updateQtys[med.uqid] : ''}
                              onChange={e => handleQtyChange(med.uqid, e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-1 min-w-[50px]">
                            {editingMedId === med.uqid ? (
                              <button
                                onClick={() => handleSaveEdit(med.uqid)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
                                title="Save Edit"
                              >
                                Save
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingMedId(med.uqid);
                                  setEditMedData({ uqid: med.uqid, name: med.name, cost: med.cost || '', formulation: med.formulation || '' });
                                }}
                                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
                                title="Edit Medicine"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdate(med.uqid)}
                              disabled={!updateQtys[med.uqid] || updateQtys[med.uqid] <= 0}
                              className="px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-lg transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
                              title="Add to existing stock"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => handleSetStock(med.uqid)}
                              disabled={updateQtys[med.uqid] === undefined || updateQtys[med.uqid] === '' || updateQtys[med.uqid] < 0}
                              className="px-3 py-1 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-lg transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
                              title="Set absolute stock value"
                            >
                              Set
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-8 py-32 text-center text-slate-700">
                      <div className="flex flex-col items-center gap-4 animate-fade-in">
                        <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 mb-2">
                          <PackageOpen size={64} strokeWidth={1} className="text-slate-200" />
                        </div>
                        <h4 className="text-xl font-black text-slate-400 tracking-tight uppercase tracking-widest text-sm">Registry Empty</h4>
                        <p className="text-sm max-w-xs mx-auto font-bold text-slate-300">The search query did not match any medicine in the database.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'camp' ? (
          /* Camp Wise View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[12px] font-black uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-4">UQID</th>
                  <th className="px-3 py-4">Medication Name</th>
                  <th className="px-3 py-4">Formulation</th>
                  <th className="px-3 py-4">Total Stock</th>
                  <th className="px-3 py-4 max-w-[130px] leading-snug">Current Month Stock</th>
                  <th className="px-3 py-4 max-w-[130px] leading-snug">Medicines Issued</th>
                  <th className="px-3 py-4">Unit Cost</th>
                  <th className="px-3 py-4">Total Cost</th>
                  <th className="px-3 py-4">Stock Balance</th>
                  <th className="px-3 py-4">Returned</th>
                  <th className="px-3 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCampStocks.length > 0 ? (
                  filteredCampStocks.map((stock) => (
                    <tr key={stock.uqid} className="hover:bg-emerald-50/40 transition-all group">
                      <td className="px-4 py-4">
                        <span className="font-data text-sm font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">#{stock.uqid}</span>
                      </td>
                      <td className="px-4 py-4 text-base font-black text-slate-800">
                        {editingUqid === stock.uqid ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tempAltName}
                              onChange={(e) => setTempAltName(e.target.value)}
                              placeholder="Alternative Name"
                              className="bg-white border border-teal-300 rounded-lg px-2.5 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm w-48"
                            />
                            <button
                              onClick={() => handleSaveAlternateName(stock.uqid)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                              title="Save Alternate Name"
                            >
                              <Check size={16} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => setEditingUqid(null)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-200"
                              title="Cancel"
                            >
                              <X size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/alt">
                            <div className="flex flex-col">
                              {stock.alternate_name ? (
                                <>
                                  <span className="text-base font-black text-slate-800">{stock.alternate_name}</span>
                                  <span className="text-xs text-slate-400 font-bold mt-0.5">
                                    Original: {stock.medication}
                                  </span>
                                </>
                              ) : (
                                <span className="text-base font-black text-slate-800">{stock.medication}</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setEditingUqid(stock.uqid);
                                setTempAltName(stock.alternate_name || '');
                              }}
                              className="p-1.5 bg-slate-50 hover:bg-teal-50 text-slate-400 hover:text-teal-600 rounded-lg border border-slate-200 hover:border-teal-200 transition-all ml-2 flex items-center justify-center shadow-sm"
                               title="Edit Alternative Name"
                            >
                              <Edit3 size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-bold text-slate-600">
                          {stock.formulation || 'Generic Formulation'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          {allocateQtys[stock.uqid] > 0 && (
                            <span className="text-sm font-black text-slate-400 line-through decoration-slate-300 animate-in fade-in slide-in-from-bottom-1">
                              {stock.total_stock}
                            </span>
                          )}
                          <span className="text-xl font-black text-slate-800 font-data">
                            {allocateQtys[stock.uqid] > 0
                              ? stock.total_stock - parseInt(allocateQtys[stock.uqid])
                              : stock.total_stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl font-black font-data border border-blue-100 text-sm">
                            {stock.camp_stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl font-black font-data border border-rose-100 text-sm">
                            {stock.used_stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-extrabold text-sm">₹</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-black font-data text-slate-700 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 shadow-sm"
                            value={
                              campUnitCosts[stock.uqid] !== undefined
                                ? campUnitCosts[stock.uqid]
                                : (stock.unit_cost !== null ? stock.unit_cost : '')
                            }
                            onChange={(e) => handleCampUnitCostChange(stock.uqid, e.target.value)}
                            onBlur={() => handleSaveCampUnitCost(stock.uqid)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-data font-black text-base text-slate-900">
                            {stock.used_stock && stock.unit_cost
                              ? `₹ ${(stock.used_stock * stock.unit_cost).toFixed(2)}`
                              : '₹ 0.00'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl font-black font-data border border-emerald-100 text-sm">
                            {stock.remaining_stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 flex items-center justify-center bg-teal-50 text-teal-600 rounded-xl font-black font-data border border-teal-100 text-sm">
                            {stock.returned_stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                            <input
                              type="number"
                              placeholder="Qty"
                              className="w-16 bg-transparent px-2 py-1 text-slate-800 font-black text-center focus:outline-none placeholder:text-slate-200 text-xs"
                              value={allocateQtys[stock.uqid] || ''}
                              onChange={e => handleAllocateQtyChange(stock.uqid, e.target.value)}
                            />
                            <button
                              onClick={() => handleAllocate(stock.uqid)}
                              disabled={!selectedCamp || !allocateQtys[stock.uqid] || allocateQtys[stock.uqid] <= 0 || allocateQtys[stock.uqid] > stock.total_stock}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-50 disabled:text-slate-200 text-white rounded-lg transition-all shadow-sm"
                              title="Allocate to Camp"
                            >
                              <PlusCircle size={16} strokeWidth={2.5} />
                            </button>
                          </div>

                          <button
                            onClick={() => handleReturn(stock.uqid, stock.medication, stock.remaining_stock)}
                            disabled={!selectedCamp || stock.remaining_stock <= 0}
                            className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-200 hover:bg-teal-50 rounded-xl transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-slate-200 flex items-center justify-center"
                            title="Update single medication (Add Available Balance to Total Stock)"
                          >
                            <RefreshCcw size={16} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="13" className="px-8 py-24 text-center text-slate-400 font-bold">No records found for camp allocation</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Medicine Details View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-4 py-4">UQID</th>
                  <th className="px-4 py-4">Medication Name</th>
                  <th className="px-4 py-4">Company Name</th>
                  <th className="px-4 py-4">Expiry Date</th>
                  <th className="px-4 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredMeds.length > 0 ? (
                  filteredMeds.map((med) => {
                    const formState = detailsForm[med.uqid] || {};
                    const campStock = campStocks.find(s => s.uqid === med.uqid);
                    const displayCompany = formState.company_name !== undefined 
                      ? formState.company_name 
                      : (selectedCamp && campStock ? campStock.company_name : (med.company_name || ''));
                    const displayExpiry = formState.expiry_date !== undefined 
                      ? formState.expiry_date 
                      : (selectedCamp && campStock ? campStock.expiry_date : (med.expiry_date || ''));
                    return (
                      <tr key={`details-${med.uqid}`} className="hover:bg-slate-50/40 transition-all group">
                        <td className="px-4 py-4">
                          <span className="font-data text-sm font-bold text-slate-400">#{med.uqid}</span>
                        </td>
                        <td className="px-4 py-4 text-base font-black text-slate-800">{med.name}</td>
                        <td className="px-4 py-4">
                          <input
                            type="text"
                            placeholder="e.g. Pfizer"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                            value={displayCompany}
                            onChange={(e) => handleDetailsChange(med.uqid, 'company_name', e.target.value)}
                          />
                        </td>

                        <td className="px-4 py-4">
                          <input
                            type="date"
                            className="w-auto bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 text-slate-600"
                            value={displayExpiry}
                            onChange={(e) => handleDetailsChange(med.uqid, 'expiry_date', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => handleSaveDetails(med.uqid)}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all shadow-sm text-xs font-black uppercase tracking-wider"
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-8 py-24 text-center text-slate-400 font-bold">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicineEntry;

