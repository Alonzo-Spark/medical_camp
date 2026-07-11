import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Pill, Search, PackageOpen, Filter, Box, PlusCircle, CheckCircle2, Heart, Landmark, RefreshCcw, AlertTriangle, Download, Edit3, Check, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`;
// Backend origin for direct file-download links (Caddy proxies /export* to the
// backend in prod; in dev this points at the :8000 dev server).
const BACKEND_BASE = API_BASE.replace(/\/api\/?$/, '');

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
  const [newMed, setNewMed] = useState({ uqid: '', name: '', formulation: '', stock: '', cost: '', category_id: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingMedId, setEditingMedId] = useState(null);
  const [editMedData, setEditMedData] = useState({ uqid: '', name: '', cost: '', formulation: '', category_id: '', stock: '' });
  const [campUnitCosts, setCampUnitCosts] = useState({});
  const [editingUqid, setEditingUqid] = useState(null);
  const [tempAltName, setTempAltName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Category management state
  const [categories, setCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryCode, setNewCategoryCode] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryCode, setEditCategoryCode] = useState('');

  useEffect(() => {
    fetchMedicines();
    fetchCamps();
    fetchCategories();
  }, []);

  useEffect(() => {
    // Reset all camp-specific local states when switching camps
    setCampUnitCosts({});
    setAllocateQtys({});
    setEditingUqid(null);
    setTempAltName('');
  }, [selectedCamp]);

  useEffect(() => {
    fetchCampStocks();
  }, [selectedCamp, medicines]);

  const fetchCamps = () => {
    axios.get(`${API_BASE}/camps`).then(res => {
      setCamps(res.data);
    });
  };

  const fetchCategories = () => {
    axios.get(`${API_BASE}/categories`).then(res => {
      setCategories(res.data);
    });
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !newCategoryCode.trim()) {
      alert('Name and Short Code are required');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/categories/create`, {
        name: newCategoryName,
        short_code: newCategoryCode
      });
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 2000);
      setNewCategoryName('');
      setNewCategoryCode('');
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleUpdateCategory = async (id) => {
    if (!editCategoryName.trim() || !editCategoryCode.trim()) {
      alert('Name and Short Code are required');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/categories/update`, {
        id,
        name: editCategoryName,
        short_code: editCategoryCode
      });
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 2000);
      setEditingCategoryId(null);
      fetchCategories();
      fetchMedicines();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await axios.post(`${API_BASE}/categories/delete`, { id });
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 2000);
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteMedicine = async (uqid, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" (UQID: ${uqid})?`)) return;
    try {
      const res = await axios.post(`${API_BASE}/delete_medicine`, { uqid });
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 2000);
      fetchMedicines();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleToggleStatus = async (med) => {
    try {
      const res = await axios.post(`${API_BASE}/toggle_medicine_status`, { uqid: med.uqid });
      if (res.data.status === 'success') {
        setMedicines(prev =>
          prev.map(m => m.uqid === med.uqid ? { ...m, is_active: res.data.is_active } : m)
        );
        setSuccessMsg(res.data.message);
        setTimeout(() => setSuccessMsg(''), 2000);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleExport = () => {
    window.location.href = `${BACKEND_BASE}/export`;
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
          category: med.category || 'Uncategorized',
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
    const { uqid, name, cost, formulation, category_id, stock } = editMedData;
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
        formulation: formulation !== '' && formulation !== null ? formulation : null,
        category_id: category_id || null,
        stock: stock !== '' && stock !== null ? parseInt(stock) : 0
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
        cost: newMed.cost !== '' ? parseFloat(newMed.cost) : null,
        category_id: newMed.category_id || null
      });

      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 3000);
      setNewMed({ uqid: '', name: '', formulation: '', stock: '', cost: '', category_id: '' });
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
    window.location.href = `${BACKEND_BASE}/export_camp_stock/${selectedCamp}`;
  };

  const filteredMeds = medicines.filter(m => {
    const searchTerms = searchTerm.toLowerCase().trim().split(/\s+/);
    const searchableText = `${m.name} ${m.formulation || ''} ${m.category || ''} ${m.uqid}`.toLowerCase();
    const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));
    const matchesCategory = selectedCategory ? m.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => Number(a.uqid) - Number(b.uqid));

  const filteredCampStocks = campStocks.filter(s => {
    const searchTerms = searchTerm.toLowerCase().trim().split(/\s+/);
    const searchableText = `${s.medication} ${s.formulation || ''} ${s.category || ''} ${s.uqid}`.toLowerCase();
    const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));
    const matchesCategory = selectedCategory ? s.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => Number(a.uqid) - Number(b.uqid));

  const getCategoryOrderKey = (catName) => {
    const rangeMatch = catName.match(/\((\d+)/);
    if (rangeMatch) return parseInt(rangeMatch[1], 10);
    const letterMatch = catName.match(/\s+-\s+([A-Z])\b/);
    if (letterMatch) return letterMatch[1].charCodeAt(0);
    return 9999;
  };

  const availableCategories = Array.from(new Set(medicines.map(m => m.category).filter(Boolean)));
  const sortedFilterCategories = [...availableCategories].sort((a, b) => {
    const keyA = getCategoryOrderKey(a);
    const keyB = getCategoryOrderKey(b);
    if (keyA !== keyB) return keyA - keyB;
    return a.localeCompare(b);
  });

  const groupedTotalMeds = filteredMeds.reduce((acc, med) => {
    const cat = med.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(med);
    return acc;
  }, {});

  const sortedTotalCategories = Object.keys(groupedTotalMeds).sort((a, b) => {
    const keyA = getCategoryOrderKey(a);
    const keyB = getCategoryOrderKey(b);
    if (keyA !== keyB) return keyA - keyB;
    return a.localeCompare(b);
  });

  const groupedCampMeds = filteredCampStocks.reduce((acc, stock) => {
    const cat = stock.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(stock);
    return acc;
  }, {});

  const sortedCampCategories = Object.keys(groupedCampMeds).sort((a, b) => {
    const keyA = getCategoryOrderKey(a);
    const keyB = getCategoryOrderKey(b);
    if (keyA !== keyB) return keyA - keyB;
    return a.localeCompare(b);
  });

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
              className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-12 py-4 text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all font-bold shadow-sm"
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
          <div className="flex gap-2">
            {viewMode === 'total' && (
              <>
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
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 bg-slate-800 hover:bg-slate-900 text-white shadow-lg"
                >
                  <Filter size={18} strokeWidth={2.5} />
                  Manage Categories
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-teal-200 shadow-sm"
                >
                  <Download size={18} strokeWidth={2.5} className="text-teal-500" />
                  Download Stock Audit (.CSV)
                </button>
              </>
            )}

            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-2 ${selectedCategory
                    ? 'bg-teal-50 border-teal-300 text-teal-600 font-bold'
                    : 'bg-white border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-200'
                  } shadow-sm`}
              >
                <Filter size={20} strokeWidth={2.5} />
                {selectedCategory && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold truncate max-w-[150px] text-teal-700 bg-teal-100/50 px-2.5 py-1 rounded border border-teal-200">
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
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 py-2 animate-fade-in max-h-[400px] overflow-y-auto">
                    <div className="px-4 py-2 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Filter by Category
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCategory(null);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold transition-all border-l-2 flex justify-between items-center ${selectedCategory === null
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
                        className={`w-full text-left px-4 py-3 text-xs font-bold transition-all border-l-2 flex justify-between items-center ${selectedCategory === cat
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
        </div>

        {showAddForm && viewMode === 'total' && (
          <div className="p-8 bg-teal-50/30 border-b border-slate-100 animate-in slide-in-from-top-4 duration-300">
            <form onSubmit={handleAddMedicine} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                <select
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all cursor-pointer appearance-none"
                  value={newMed.category_id}
                  onChange={e => setNewMed({ ...newMed, category_id: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.short_code})
                    </option>
                  ))}
                </select>
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
                  sortedTotalCategories.map((categoryName) => (
                    <React.Fragment key={categoryName}>
                      <tr className="bg-slate-100/60 border-y border-slate-200">
                        <td colSpan="6" className="px-8 py-3.5">
                          <div className="flex items-center justify-center gap-3">
                            <span className="font-extrabold text-[11px] text-teal-800 uppercase tracking-[0.2em] font-sans">
                              {categoryName}
                            </span>
                            <span className="bg-teal-50 text-teal-700 text-[10px] font-black px-3 py-1 rounded-full border border-teal-100/50">
                              {groupedTotalMeds[categoryName].length} {groupedTotalMeds[categoryName].length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {groupedTotalMeds[categoryName].map((med) => (
                        <tr
                          key={med.uqid}
                          className={`transition-all group ${med.is_active ? 'hover:bg-teal-50/40' : 'bg-slate-50/50 opacity-55 hover:opacity-100'}`}
                        >
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
                                <select
                                  className="w-full bg-white border border-teal-300 rounded-lg px-2 py-1 text-xs font-extrabold outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm mt-1 cursor-pointer"
                                  value={editMedData.category_id || ''}
                                  onChange={(e) => setEditMedData({ ...editMedData, category_id: e.target.value })}
                                >
                                  <option value="">No Category</option>
                                  {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-black text-slate-800 group-hover:text-teal-700 transition-colors">{med.name}</span>
                                <span className="text-xs text-slate-600 font-extrabold uppercase tracking-wider px-2 py-0.5 bg-slate-50 rounded-md border border-slate-100">
                                  {med.formulation || 'Generic Formulation'}
                                </span>
                                {!med.is_active && (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded border border-red-200">
                                    Inactive
                                  </span>
                                )}
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
                                editMedData.cost && !isNaN(parseFloat(editMedData.cost)) && editMedData.stock && !isNaN(parseInt(editMedData.stock))
                                  ? `₹ ${(parseFloat(editMedData.cost) * parseInt(editMedData.stock)).toFixed(2)}`
                                  : '₹ 0.00'
                              ) : (
                                med.cost ? `₹ ${(parseFloat(med.cost) * med.stock).toFixed(2)}` : '₹ 0.00'
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              {editingMedId === med.uqid ? (
                                <input
                                  type="number"
                                  className="w-full max-w-[100px] bg-white border border-teal-300 rounded-lg px-2 py-1.5 text-sm font-data outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                                  value={editMedData.stock !== undefined ? editMedData.stock : ''}
                                  onChange={(e) => setEditMedData({ ...editMedData, stock: e.target.value })}
                                />
                              ) : (
                                <span className={`text-xl font-black font-data ${med.stock > 10 ? 'text-slate-800' : 'text-rose-600'}`}>
                                  {med.stock}
                                </span>
                              )}
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
                                <button
                                  onClick={() => handleUpdate(med.uqid)}
                                  disabled={!updateQtys[med.uqid] || updateQtys[med.uqid] <= 0}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-lg transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
                                  title="Add to existing stock"
                                >
                                  Add
                                </button>
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
                                      setEditMedData({ uqid: med.uqid, name: med.name, cost: med.cost || '', formulation: med.formulation || '', category_id: med.category_id || '', stock: med.stock || 0 });
                                    }}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
                                    title="Edit Medicine"
                                  >
                                    Edit
                                  </button>
                                )}
                                {med.is_active ? (
                                  <button
                                    onClick={() => handleDeleteMedicine(med.uqid, med.name)}
                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
                                    title="Delete Medicine (deactivates it)"
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleToggleStatus(med)}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm text-[10px] font-black uppercase tracking-widest"
                                    title="Reactivate Medicine"
                                  >
                                    Reactivate
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
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
                  <th className="px-3 py-4">Total Stock</th>
                  <th className="px-3 py-4 max-w-[130px] leading-snug">Current Month Stock</th>
                  <th className="px-3 py-4 max-w-[130px] leading-snug">Medicines Issued</th>
                  <th className="px-3 py-4">Unit Cost</th>
                  <th className="px-3 py-4">Total Cost</th>
                  <th className="px-3 py-4">Stock Balance</th>
                  <th className="px-3 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCampStocks.length > 0 ? (
                  sortedCampCategories.map((categoryName) => (
                    <React.Fragment key={categoryName}>
                      <tr className="bg-slate-100/60 border-y border-slate-200">
                        <td colSpan="9" className="px-8 py-3.5">
                          <div className="flex items-center justify-center gap-3">
                            <span className="font-extrabold text-[11px] text-teal-800 uppercase tracking-[0.2em] font-sans">
                              {categoryName}
                            </span>
                            <span className="bg-teal-50 text-teal-700 text-[10px] font-black px-3 py-1 rounded-full border border-teal-100/50">
                              {groupedCampMeds[categoryName].length} {groupedCampMeds[categoryName].length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {groupedCampMeds[categoryName].map((stock) => (
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
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-8 py-24 text-center text-slate-400 font-bold">No records found for camp allocation</td>
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
                  sortedTotalCategories.map((categoryName) => (
                    <React.Fragment key={categoryName}>
                      <tr className="bg-slate-100/60 border-y border-slate-200">
                        <td colSpan="5" className="px-8 py-3.5">
                          <div className="flex items-center justify-center gap-3">
                            <span className="font-extrabold text-[11px] text-teal-800 uppercase tracking-[0.2em] font-sans">
                              {categoryName}
                            </span>
                            <span className="bg-teal-50 text-teal-700 text-[10px] font-black px-3 py-1 rounded-full border border-teal-100/50">
                              {groupedTotalMeds[categoryName].length} {groupedTotalMeds[categoryName].length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {groupedTotalMeds[categoryName].map((med) => {
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
                      })}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-8 py-24 text-center text-slate-400 font-bold">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Management Modal */}
      {showCategoryModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-800">Manage Medicine Categories</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1">Add, edit, or delete inventory categories</p>
              </div>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Category list */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Existing Categories</h4>
                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {categories.length > 0 ? (
                    categories.map(cat => (
                      <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                        {editingCategoryId === cat.id ? (
                          <div className="flex gap-2 flex-1 mr-4">
                            <input
                              type="text"
                              className="flex-1 bg-white border border-teal-300 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                              value={editCategoryName}
                              onChange={e => setEditCategoryName(e.target.value)}
                              placeholder="Category Name"
                            />
                            <input
                              type="text"
                              className="w-28 bg-white border border-teal-300 rounded-xl px-3 py-2 text-sm font-bold outline-none uppercase"
                              value={editCategoryCode}
                              onChange={e => setEditCategoryCode(e.target.value)}
                              placeholder="Code"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-sm">{cat.name}</span>
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">
                              {cat.short_code}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          {editingCategoryId === cat.id ? (
                            <>
                              <button
                                onClick={() => handleUpdateCategory(cat.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                title="Save"
                              >
                                <Check size={18} strokeWidth={3} />
                              </button>
                              <button
                                onClick={() => setEditingCategoryId(null)}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                title="Cancel"
                              >
                                <X size={18} strokeWidth={3} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingCategoryId(cat.id);
                                  setEditCategoryName(cat.name);
                                  setEditCategoryCode(cat.short_code);
                                }}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                title="Edit"
                              >
                                <Edit3 size={18} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                title="Delete"
                              >
                                <X size={18} strokeWidth={2.5} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 font-semibold text-sm">No categories configured.</div>
                  )}
                </div>
              </div>

              {/* Create new category */}
              <form onSubmit={handleCreateCategory} className="border-t border-slate-100 pt-6 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add New Category</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Antibiotic"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Short Code</label>
                    <input
                      type="text"
                      placeholder="e.g. ANT"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all uppercase"
                      value={newCategoryCode}
                      onChange={e => setNewCategoryCode(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-teal-600 text-white h-[42px] rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-teal-700 transition-all shadow-sm"
                  >
                    Add Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MedicineEntry;

