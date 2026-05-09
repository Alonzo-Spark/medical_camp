import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pill, Search, PackageOpen, Filter, Box, PlusCircle, CheckCircle2, Heart, Landmark, RefreshCcw, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

const MedicineEntry = () => {
  const [medicines, setMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updateQtys, setUpdateQtys] = useState({}); // To store input values for each med {uqid: value}
  const [successMsg, setSuccessMsg] = useState('');
  const [viewMode, setViewMode] = useState('total'); // 'total' or 'camp'
  const [campStocks, setCampStocks] = useState([]);
  const [allocateQtys, setAllocateQtys] = useState({});
  const [camps, setCamps] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMed, setNewMed] = useState({ uqid: '', name: '', formulation: '', stock: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');



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
    axios.get(`${API_BASE}/medicines`).then(res => {
      setMedicines(res.data);
      setLoading(false);
    });
  };

  const fetchCampStocks = () => {
    if (!selectedCamp) {
      setCampStocks([]);
      return;
    }
    axios.get(`${API_BASE}/camp_stock/${selectedCamp}`).then(res => {
      // Convert object {uqid: {allocated, used, remaining}} to array for mapping
      const stocksArray = Object.keys(res.data).map(uqid => {
        const med = medicines.find(m => m.uqid === parseInt(uqid));
        return {
          uqid: parseInt(uqid),
          medication: med ? med.name : 'Unknown Medication',
          total_stock: med ? med.stock : 0,
          camp_stock: res.data[uqid].allocated,
          used_stock: res.data[uqid].used,
          remaining_stock: res.data[uqid].remaining
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

  const handleReturn = async (uqid) => {
    if (!selectedCamp) return;
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
        stock: parseInt(newMed.stock) || 0
      });
      
      setSuccessMsg(res.data.message);
      setTimeout(() => setSuccessMsg(''), 3000);
      setNewMed({ uqid: '', name: '', formulation: '', stock: '' });
      setShowAddForm(false);
      fetchMedicines(); // Refresh the list
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setIsAdding(false);
    }

  };


  const filteredMeds = medicines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.uqid.toString().includes(searchTerm)
  );

  const filteredCampStocks = campStocks.filter(s => 
    s.medication.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.uqid.toString().includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
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
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${
            viewMode === 'total' 
              ? 'bg-teal-600 text-white shadow-xl shadow-teal-100 scale-[1.02]' 
              : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <Box size={18} strokeWidth={2.5} />
          Total Stock Entry
        </button>
        <button 
          onClick={() => setViewMode('camp')}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${
            viewMode === 'camp' 
              ? 'bg-teal-600 text-white shadow-xl shadow-teal-100 scale-[1.02]' 
              : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <Landmark size={18} strokeWidth={2.5} />
          Camp Wise Entry
        </button>
        
        {viewMode === 'camp' && (
          <div className="flex flex-1 items-center gap-4 animate-in fade-in slide-in-from-left-4">
            <select
              className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black text-slate-600 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer"
              value={selectedCamp}
              onChange={e => setSelectedCamp(e.target.value)}
            >
              <option value="">Select Target Camp...</option>
              {camps.map(camp => (
                <option key={camp.id} value={camp.id}>
                  {camp.venue} • Camp {camp.number}
                </option>
              ))}
            </select>
            
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
                className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${
                  showAddForm 
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
            <form onSubmit={handleAddMedicine} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">UQID (Optional)</label>
                <input
                  type="number"
                  placeholder="Auto-gen"
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={newMed.uqid}
                  onChange={e => setNewMed({...newMed, uqid: e.target.value})}
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
                  onChange={e => setNewMed({...newMed, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Formulation</label>
                <input
                  type="text"
                  placeholder="e.g. 500mg Tablet"
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={newMed.formulation}
                  onChange={e => setNewMed({...newMed, formulation: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initial Stock</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                  value={newMed.stock}
                  onChange={e => setNewMed({...newMed, stock: e.target.value})}
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
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-8 py-5">System Identity (UQID)</th>
                  <th className="px-8 py-5">Medication Description</th>
                  <th className="px-8 py-5">Global Inventory Status</th>
                  <th className="px-8 py-5 text-right">Add to Global Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin" />
                        <span className="font-black uppercase tracking-widest text-[10px] text-slate-400">Syncing Repository...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMeds.length > 0 ? (
                  filteredMeds.map((med) => (
                    <tr key={med.uqid} className="hover:bg-teal-50/40 transition-all group">
                      <td className="px-8 py-6">
                         <span className="font-data text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
                          #{med.uqid}
                         </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col max-w-md">
                          <span className="font-black text-slate-800 group-hover:text-teal-700 transition-colors truncate">{med.name}</span>
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-0.5 truncate">{med.formulation || 'Generic Formulation'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex flex-col">
                          <span className={`text-lg font-black font-data ${med.stock > 10 ? 'text-slate-800' : 'text-rose-600'}`}>
                            {med.stock}
                          </span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Available Units</span>
                         </div>
                      </td>
                      <td className="px-8 py-6 text-right">
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
                             <div className="flex flex-col gap-1">
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
                    <td colSpan="4" className="px-8 py-32 text-center text-slate-700">
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
        ) : (
          /* Camp Wise View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-8 py-5">UQID</th>
                  <th className="px-8 py-5">Medication Name</th>
                  <th className="px-8 py-5">Warehouse</th>
                  <th className="px-8 py-5">Allocated</th>
                  <th className="px-8 py-5">Used</th>
                  <th className="px-8 py-5">Available</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCampStocks.length > 0 ? (
                  filteredCampStocks.map((stock) => (
                    <tr key={stock.uqid} className="hover:bg-emerald-50/40 transition-all group">
                      <td className="px-8 py-6">
                         <span className="font-data text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">#{stock.uqid}</span>
                      </td>
                      <td className="px-8 py-6 font-black text-slate-800">{stock.medication}</td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          {allocateQtys[stock.uqid] > 0 && (
                            <span className="text-sm font-black text-slate-400 line-through decoration-slate-300 animate-in fade-in slide-in-from-bottom-1">
                              {stock.total_stock}
                            </span>
                          )}
                          <span className="text-lg font-black text-slate-800 font-data">
                            {allocateQtys[stock.uqid] > 0 
                              ? stock.total_stock - parseInt(allocateQtys[stock.uqid]) 
                              : stock.total_stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-3">
                            <span className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl font-black font-data border border-blue-100 text-xs">
                               {stock.camp_stock}
                            </span>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-3">
                            <span className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl font-black font-data border border-rose-100 text-xs">
                               {stock.used_stock}
                            </span>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-3">
                            <span className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl font-black font-data border border-emerald-100 text-xs">
                               {stock.remaining_stock}
                            </span>
                         </div>
                      </td>
                      <td className="px-8 py-6 text-right">
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
                             onClick={() => handleReturn(stock.uqid)}
                             disabled={!selectedCamp || stock.remaining_stock <= 0}
                             className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-200 hover:bg-teal-50 rounded-xl transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-slate-200"
                             title="Return Leftover to Warehouse"
                           >
                             <RefreshCcw size={18} strokeWidth={2.5} />
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))
                ) : (
                   <tr>
                    <td colSpan="5" className="px-8 py-24 text-center text-slate-400 font-bold">No records found for camp allocation</td>
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

