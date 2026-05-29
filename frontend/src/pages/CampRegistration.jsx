import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
  Hospital, Save, CheckCircle2, HeartPulse, Calendar, Hash,
  AlertCircle, Stethoscope
} from 'lucide-react';

<<<<<<< HEAD
const API_BASE = '/api';
=======
const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`;
>>>>>>> c6659da61c08e3b8d274bc51787783944d4b4306

const CampRegistration = () => {
  const [campId, setCampId] = useState('');
  const [campDate, setCampDate] = useState('');
  const [venue, setVenue] = useState(''); // Added Venue state
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dateInputRef = useRef(null);

  // Handle native date picker change → convert to dd/mm/yyyy
  const handleNativeDateChange = (e) => {
    const val = e.target.value; // yyyy-mm-dd
    if (val) {
      const [y, m, d] = val.split('-');
      setCampDate(`${d}/${m}/${y}`);
    }
  };

  // Handle manual text input for date
  const handleDateTextChange = (value) => {
    // Allow digits and slashes only, auto-insert slashes
    let cleaned = value.replace(/[^\d/]/g, '');

    // Auto-insert slashes after dd and mm
    if (cleaned.length === 2 && !cleaned.includes('/')) {
      cleaned += '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2) {
      cleaned += '/';
    }

    if (cleaned.length <= 10) {
      setCampDate(cleaned);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!campId.trim()) {
      setError('Camp ID is required');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Validate date format dd/mm/yyyy
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!campDate || !dateRegex.test(campDate)) {
      setError('Invalid date format. Use DD/MM/YYYY');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      // Convert dd/mm/yyyy to yyyy-mm-dd for API
      const [d, m, y] = campDate.split('/');
      const apiDate = `${y}-${m}-${d}`;

      await axios.post(`${API_BASE}/register_camp`, {
        camp_number: campId,
        date: apiDate,
        venue_name: venue
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      setCampId('');
      setCampDate('');
      setVenue('');
    } catch (err) {
      setError(err.response?.data?.message || 'Error registering camp. Please try again.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse size={14} className="text-teal-500" />
            <p className="text-teal-600 text-[10px] font-extrabold uppercase tracking-[0.25em]">Administration</p>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200">
              <Stethoscope className="text-teal-600" size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">Medical Camp Registration</h3>
          </div>
          <p className="text-slate-400 text-sm font-bold ml-[52px]">Register a new medical camp session</p>
        </div>

        {/* Success / Error badges */}
        <div className="flex gap-3">
          {success && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-3 rounded-xl border border-emerald-200 shadow-sm animate-bounce">
              <CheckCircle2 size={18} strokeWidth={3} />
              <span className="text-xs font-black uppercase tracking-widest">Camp Registered</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-5 py-3 rounded-xl border border-rose-200 shadow-sm">
              <AlertCircle size={18} strokeWidth={3} />
              <span className="text-xs font-black uppercase tracking-widest">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="glass-panel-light p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Camp Venue / Location */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <Hospital size={12} className="text-teal-500" strokeWidth={2.5} />
              Camp Venue / Location
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Community Center, City Hall"
              value={venue}
              onChange={e => setVenue(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-xl font-black text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all shadow-sm hover:border-slate-300"
            />
          </div>

          {/* Camp ID / Number */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <Hash size={12} className="text-teal-500" strokeWidth={2.5} />
              Camp Number
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-xl font-black text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all shadow-sm hover:border-slate-300"
              placeholder="Enter Camp ID..."
              value={campId}
              onChange={e => {
                const val = e.target.value;
                if (/\D/.test(val)) {
                  alert("Please enter numbers only for the Camp Number.");
                  setCampId(val.replace(/\D/g, ''));
                } else {
                  setCampId(val);
                }
              }}
            />
          </div>

          {/* Camp Date */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <Calendar size={12} className="text-indigo-500" strokeWidth={2.5} />
              Camp Date
              <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="DD/MM/YYYY"
                value={campDate}
                onChange={e => handleDateTextChange(e.target.value)}
                className={`w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-xl font-black placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-all shadow-sm hover:border-slate-300 pr-14 ${!campDate ? 'text-slate-400' : 'text-slate-800'}`}
              />
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker()}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-teal-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
              >
                <Calendar size={22} strokeWidth={2.5} />
              </button>
              {/* Hidden native date input for calendar picker */}
              <input
                type="date"
                ref={dateInputRef}
                onChange={handleNativeDateChange}
                className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                tabIndex={-1}
              />
            </div>
            <p className="text-[10px] text-slate-400 font-bold ml-1">
              Click the calendar icon or type the date manually in DD/MM/YYYY format
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white h-16 rounded-2xl transition-all shadow-xl shadow-teal-200/50 group active:scale-[0.99]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <div className="relative flex items-center justify-center gap-3">
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={20} strokeWidth={2.5} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  <span className="text-sm font-black uppercase tracking-[0.2em]">Register Camp</span>
                </>
              )}
            </div>
          </button>
        </form>
      </div>
    </div>
  );
};

export default CampRegistration;
