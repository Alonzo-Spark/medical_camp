import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { UserPlus, Save, RotateCcw, ArrowLeft, Heart, Calendar, MapPin, Phone, User, Landmark, Hash, CheckCircle2, AlertTriangle, UserCheck } from "lucide-react";

const API_BASE = `http://${window.location.hostname}:8000/api`;

function PatientRegistration() {
    const navigate = useNavigate();
    const dateInputRef = useRef(null);
    const [camps, setCamps] = useState([]);
    const [form, setForm] = useState({
        pid: "",
        name: "",
        age: "",
        gender: "",
        regdate: "", // Stores DD/MM/YYYY for display and logic
        camp_session: "",
        contact: "",
        address: "",
    });

    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [pidChecking, setPidChecking] = useState(false);

    useEffect(() => {
        axios.get(`${API_BASE}/camps`).then(res => {
            const campList = res.data;
            setCamps(campList);
            
            // Auto-fill with the latest camp if available
            // Synchronize with the last camp session date
            if (res.data.length > 0) {
                const latestCamp = res.data[res.data.length - 1];
                let formattedDate = latestCamp.date;
                if (formattedDate && !formattedDate.includes('/')) {
                    const [y, m, d] = formattedDate.split('-');
                    formattedDate = `${d}/${m}/${y}`;
                }
                setForm(prev => ({
                    ...prev,
                    regdate: formattedDate || "",
                    camp_session: latestCamp.number || ""
                }));
            }
        });
    }, []);

    const handleChange = (field, value) => {
        if (field === "regdate") {
            // Auto-format DD/MM/YYYY for text entry
            let val = value.replace(/\D/g, '');
            if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
            if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5, 9);
            setForm({ ...form, [field]: val });
        } else {
            setForm({ ...form, [field]: value });
        }
        setErrors({ ...errors, [field]: "" });
    };

    const handleNativeDateChange = (e) => {
        const val = e.target.value; // YYYY-MM-DD
        if (val) {
            const [y, m, d] = val.split('-');
            setForm({ ...form, regdate: `${d}/${m}/${y}` });
            setErrors({ ...errors, regdate: "" });
        }
    };

    const handlePidBlur = async () => {
        const pid = form.pid.trim();
        if (!pid) return;

        setPidChecking(true);
        try {
            const res = await axios.get(`${API_BASE}/check_patient_id/${pid}`);
            if (res.data.exists) {
                setErrors(prev => ({
                    ...prev,
                    pid: "Patient ID already exists. Please use a different ID.",
                }));
            }
        } catch (err) {
            console.error("Error checking Patient ID:", err);
        } finally {
            setPidChecking(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        let newErrors = {};
        let valid = true;

        if (!form.pid) { newErrors.pid = "Patient ID required"; valid = false; }
        if (!form.name) { newErrors.name = "Name required"; valid = false; }
        if (!form.age || form.age < 0 || form.age > 130) { newErrors.age = "Valid age required"; valid = false; }

        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        if (!form.regdate || !dateRegex.test(form.regdate)) {
            newErrors.regdate = "Invalid date (DD/MM/YYYY)";
            valid = false;
        }

        if (!form.camp_session) { newErrors.camp_session = "Required"; valid = false; }
        if (!form.contact) { newErrors.contact = "Required"; valid = false; }
        if (!form.address) { newErrors.address = "Required"; valid = false; }

        setErrors(newErrors);
        if (!valid || errors.pid) return;

        setLoading(true);
        try {
            const [d, m, y] = form.regdate.split('/');
            const apiDate = `${y}-${m}-${d}`;

            await axios.post(`${API_BASE}/register_patient`, { 
                ...form, 
                regdate: apiDate,
                is_new: true 
            });
            setSuccess(true);
            setForm(prev => ({
                ...prev,
                pid: "",
                name: "",
                age: "",
                gender: "",
                contact: "",
                address: "",
                // Preserve regdate and camp_session
            }));
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            alert("Error registering patient: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setForm({
            pid: "", name: "", age: "", gender: "",
            regdate: "",
            camp_session: "", contact: "", address: "",
        });
        setErrors({});
    };

    const inputBase = `w-full bg-white border rounded-xl px-4 py-3.5 text-[15px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all duration-300`;
    const inputNormal = `${inputBase} border-slate-200 focus:ring-teal-500/30 focus:border-teal-500`;
    const inputError = `${inputBase} border-red-300 focus:ring-red-300/30 focus:border-red-500 bg-red-50/30`;

    return (
        <div className="max-w-5xl mx-auto py-4 space-y-6">
            {/* Tabs */}
            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-fit mx-auto border border-slate-200/60 backdrop-blur-sm shadow-sm">
                <button 
                    onClick={() => navigate('/register-old')}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                >
                    <UserCheck size={16} strokeWidth={2.5} />
                    Old Patient Registration
                </button>
                <button 
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 bg-white text-teal-600 shadow-md shadow-slate-200/50"
                >
                    <UserPlus size={16} strokeWidth={2.5} />
                    New Patient Registration
                </button>
            </div>

            <div className="glass-panel-light p-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400" />

                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-1">
                        <Heart size={14} className="text-teal-500" />
                        <p className="text-teal-600 text-[10px] font-extrabold uppercase tracking-[0.25em]">Admissions Center</p>
                    </div>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200">
                            <UserPlus size={24} className="text-teal-600" strokeWidth={2.5} />
                        </div>
                        Patient Registration
                    </h3>
                    <p className="text-slate-400 text-sm font-bold mt-2 ml-[52px]">Register new patients for medical camp services</p>
                </div>

                <form id="patient-registration-form" onSubmit={handleSubmit} className="space-y-8">
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-[11px] font-extrabold text-teal-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                            Patient Identity
                        </h4>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Patient ID <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="e.g. 1001"
                                        value={form.pid}
                                        onChange={(e) => handleChange("pid", e.target.value)}
                                        onBlur={handlePidBlur}
                                        className={`${errors.pid ? inputError : inputNormal} text-slate-800`}
                                    />
                                    {pidChecking && (
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin" />
                                        </span>
                                    )}
                                </div>
                                {errors.pid && (
                                    <p className="text-red-500 text-[11px] mt-2 font-bold flex items-center gap-1.5">
                                        <AlertTriangle size={12} /> {errors.pid}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Patient Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Patient's full name"
                                    value={form.name}
                                    onChange={(e) => handleChange("name", e.target.value)}
                                    className={`${errors.name ? inputError : inputNormal} text-slate-800`}
                                />
                                {errors.name && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.name}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-[11px] font-extrabold text-teal-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                            Demographics
                        </h4>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Age <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="number"
                                    placeholder="Age"
                                    value={form.age}
                                    onChange={(e) => handleChange("age", e.target.value)}
                                    className={`${errors.age ? inputError : inputNormal} text-slate-800`}
                                />
                                {errors.age && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.age}</p>}
                            </div>
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Gender
                                </label>
                                <select
                                    value={form.gender}
                                    onChange={(e) => handleChange("gender", e.target.value)}
                                    className={`${inputNormal} appearance-none ${!form.gender ? 'text-slate-400' : 'text-slate-800'}`}
                                >
                                    <option value="">Select gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-[11px] font-extrabold text-teal-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                            Camp & Registration
                        </h4>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Date of Registration <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="DD/MM/YYYY"
                                        value={form.regdate}
                                        onChange={(e) => handleChange("regdate", e.target.value)}
                                        className={`${errors.regdate ? inputError : inputNormal} ${!form.regdate ? 'text-slate-400' : 'text-slate-800'} pr-12`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => dateInputRef.current.showPicker()}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-teal-500 hover:text-teal-600 transition-colors"
                                    >
                                        <Calendar size={20} strokeWidth={2.5} />
                                    </button>
                                    {/* Hidden native date input for calendar picker */}
                                    <input
                                        type="date"
                                        ref={dateInputRef}
                                        onChange={handleNativeDateChange}
                                        className="absolute opacity-0 pointer-events-none right-10 top-1/2 -translate-y-1/2"
                                    />
                                </div>
                                {errors.regdate && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.regdate}</p>}
                            </div>
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Camp Session <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={form.camp_session}
                                    onChange={(e) => handleChange("camp_session", e.target.value)}
                                    className={`${errors.camp_session ? inputError : inputNormal} appearance-none ${!form.camp_session ? 'text-slate-400' : 'text-slate-800'}`}
                                >
                                    <option value="">Select camp session</option>
                                    {camps.map(camp => (
                                        <option key={camp.id} value={camp.number}>{camp.venue} • Camp {camp.number}</option>
                                    ))}
                                </select>
                                {errors.camp_session && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.camp_session}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-[11px] font-extrabold text-teal-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                            Contact Information
                        </h4>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Contact No <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="+91 XXXXXXXXXX"
                                    value={form.contact}
                                    onChange={(e) => handleChange("contact", e.target.value)}
                                    className={`${errors.contact ? inputError : inputNormal} text-slate-800`}
                                />
                                {errors.contact && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.contact}</p>}
                            </div>
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Address <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Full address"
                                    value={form.address}
                                    onChange={(e) => handleChange("address", e.target.value)}
                                    className={`${errors.address ? inputError : inputNormal} text-slate-800`}
                                />
                                {errors.address && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.address}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                        <button
                            type="submit"
                            disabled={loading || pidChecking || !!errors.pid}
                            className="flex-1 relative overflow-hidden bg-teal-600 hover:bg-teal-700 text-white h-14 rounded-xl transition-all shadow-lg shadow-teal-100 group disabled:opacity-50 active:scale-[0.98]"
                        >
                            <div className="relative flex items-center justify-center gap-3">
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <UserPlus size={18} strokeWidth={2.5} />
                                        <span className="text-xs font-black uppercase tracking-widest">Register Patient</span>
                                    </>
                                )}
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={handleClear}
                            className="flex items-center justify-center gap-2 px-8 h-14 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all font-black text-xs uppercase tracking-widest"
                        >
                            <RotateCcw size={16} strokeWidth={2.5} />
                            Reset
                        </button>

                        {success && (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-3 rounded-xl border border-emerald-200 shadow-sm animate-bounce">
                                <CheckCircle2 size={18} strokeWidth={3} />
                                <span className="text-xs font-black uppercase tracking-widest">Enrolled Successfully</span>
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PatientRegistration;


