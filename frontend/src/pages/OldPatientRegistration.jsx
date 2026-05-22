import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { UserCheck, Save, RotateCcw, ArrowLeft, Heart, Calendar, MapPin, Phone, User, Landmark, Hash, CheckCircle2, AlertTriangle, Search, UserPlus } from "lucide-react";

const API_BASE = `http://${window.location.hostname}:8000/api`;

function OldPatientRegistration() {
    const navigate = useNavigate();
    const dateInputRef = useRef(null);
    const [camps, setCamps] = useState([]);
    const [patientFound, setPatientFound] = useState(false);
    const [originalPatient, setOriginalPatient] = useState({});
    const [searchLoading, setSearchLoading] = useState(false);
    const [form, setForm] = useState({
        pid: "",
        name: "",
        age: "",
        gender: "",
        regdate: "",
        camp_session: "",
        contact: "",
        address: "",
    });

    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${API_BASE}/camps`).then(res => {
            const campList = res.data;
            setCamps(campList);

            // Auto-fill with the latest camp if available
            if (campList.length > 0) {
                const latestCamp = campList[campList.length - 1];
                let formattedDate = latestCamp.date;
                if (formattedDate && !formattedDate.includes('/')) {
                    const [y, m, d] = formattedDate.split('-');
                    formattedDate = `${d}/${m}/${y}`;
                }

                setForm(prev => ({
                    ...prev,
                    regdate: formattedDate,
                    camp_session: latestCamp.number
                }));
            }
        });
    }, []);

    const handleChange = (field, value) => {
        if (field === "regdate") {
            let val = value.replace(/\D/g, '');
            if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
            if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5, 9);
            setForm({ ...form, [field]: val });
        } else if (field === "contact") {
            let val = value.replace(/\D/g, '');
            if (val.length > 10) {
                alert("Phone number cannot exceed 10 digits");
                val = val.slice(0, 10);
            }
            setForm({ ...form, [field]: val });
        } else {
            setForm({ ...form, [field]: value });
        }
        setErrors({ ...errors, [field]: "" });
    };

    const handleNativeDateChange = (e) => {
        const val = e.target.value;
        if (val) {
            const [y, m, d] = val.split('-');
            setForm({ ...form, regdate: `${d}/${m}/${y}` });
            setErrors({ ...errors, regdate: "" });
        }
    };

    const handleSearchPatient = async () => {
        const pid = form.pid.trim();
        if (!pid) {
            setErrors(prev => ({ ...prev, pid: "Please enter a Patient ID to search" }));
            return;
        }

        setSearchLoading(true);
        setPatientFound(false);
        try {
            const res = await axios.get(`${API_BASE}/check_patient_id/${pid}`);
            if (res.data.exists) {
                // Patient found — fetch full details
                const patientRes = await axios.get(`${API_BASE}/patient/${pid}`);
                const patient = patientRes.data.info;
                setOriginalPatient(patient);
                setForm(prev => {
                    let formattedDate = prev.regdate;
                    if (patient.registered_date) {
                        if (patient.registered_date.includes('/')) {
                            formattedDate = patient.registered_date;
                        } else if (patient.registered_date.includes('-')) {
                            const [y, m, d] = patient.registered_date.split('-');
                            formattedDate = `${d}/${m}/${y}`;
                        } else {
                            formattedDate = patient.registered_date;
                        }
                    }
                    return {
                        ...prev,
                        name: patient.name || "",
                        age: patient.age ? String(patient.age) : "",
                        gender: patient.gender || "",
                        contact: patient.contact || "",
                        address: patient.address || "",
                        regdate: formattedDate,
                        camp_session: patient.camp_session || prev.camp_session
                    };
                });
                setPatientFound(true);
                setErrors(prev => ({ ...prev, pid: "" }));
            } else {
                setErrors(prev => ({ ...prev, pid: "Patient ID not found. Please check and try again." }));
                setPatientFound(false);
            }
        } catch (err) {
            setErrors(prev => ({ ...prev, pid: "Error searching for patient. Please try again." }));
            setPatientFound(false);
        } finally {
            setSearchLoading(false);
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

        const contactRegex = /^\d{10}$/;
        if (!form.contact) { 
            newErrors.contact = "Required"; 
            valid = false; 
        } else if (!contactRegex.test(form.contact)) {
            newErrors.contact = "Phone number must be exactly 10 digits";
            valid = false;
            alert("Phone number must be exactly 10 digits");
        }

        if (!form.address) { newErrors.address = "Required"; valid = false; }

        setErrors(newErrors);
        if (!valid) return;

        setLoading(true);
        try {
            const [d, m, y] = form.regdate.split('/');
            const apiDate = `${y}-${m}-${d}`;

            await axios.post(`${API_BASE}/register_patient`, { 
                ...form, 
                regdate: apiDate,
                is_new: false
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
            }));
            setPatientFound(false);
            setOriginalPatient({});
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
        setPatientFound(false);
        setOriginalPatient({});
    };

    const inputBase = `w-full bg-white border rounded-xl px-4 py-3.5 text-[15px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all duration-300`;
    const inputNormal = `${inputBase} border-slate-200 focus:ring-teal-500/30 focus:border-teal-500`;
    const inputError = `${inputBase} border-red-300 focus:ring-red-300/30 focus:border-red-500 bg-red-50/30`;
    const inputDisabled = `${inputBase} border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed`;

    return (
        <div className="max-w-5xl mx-auto py-4 space-y-6">
            {/* Tabs */}
            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-fit mx-auto border border-slate-200/60 backdrop-blur-sm shadow-sm">
                <button 
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 bg-white text-teal-600 shadow-md shadow-slate-200/50"
                >
                    <UserCheck size={16} strokeWidth={2.5} />
                    Old Patient Registration
                </button>
                <button 
                    onClick={() => navigate('/register')}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                >
                    <UserPlus size={16} strokeWidth={2.5} />
                    New Patient Registration
                </button>
            </div>

            <div className="glass-panel-light p-6 pb-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400" />

                <div className="mb-5 flex items-center gap-3">
                    <div className="p-2 bg-teal-50 rounded-xl border border-teal-200">
                        <UserCheck size={20} className="text-teal-600" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Old Patient Registration</h3>
                        <p className="text-slate-400 text-xs font-bold">Re-verify and register existing patients</p>
                    </div>
                </div>

                <form id="old-patient-registration-form" onSubmit={handleSubmit} className="space-y-4">
                    {/* Patient Search Section */}
                    <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
                        <div className="grid md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-8">
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Patient Unique ID <span className="text-teal-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Enter Patient ID (e.g. 101)"
                                        value={form.pid}
                                        onChange={(e) => handleChange("pid", e.target.value)}
                                        className={`${errors.pid ? inputError : inputNormal} text-slate-800 pr-12 h-12 text-base font-black tracking-tight`}
                                    />
                                    {searchLoading && (
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <div className="w-5 h-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="md:col-span-4">
                                <button
                                    type="button"
                                    onClick={handleSearchPatient}
                                    disabled={searchLoading}
                                    className="w-full flex items-center justify-center gap-3 h-12 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-200 disabled:opacity-50 active:scale-[0.98]"
                                >
                                    <Search size={16} strokeWidth={2.5} />
                                    Find Patient
                                </button>
                            </div>
                        </div>
                        {errors.pid && (
                            <p className="text-rose-500 text-[10px] mt-2 font-bold flex items-center gap-1 ml-1">
                                <AlertTriangle size={12} /> {errors.pid}
                            </p>
                        )}
                        {patientFound && (
                            <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 animate-fade-in">
                                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                                    <CheckCircle2 size={14} strokeWidth={3} />
                                </div>
                                <div>
                                    <p className="text-emerald-800 text-[11px] font-black uppercase tracking-wide">Record Located</p>
                                    <p className="text-emerald-600/85 text-[9px] font-bold uppercase tracking-widest">Details successfully loaded from registry.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Row 1: Patient Name, Age, Gender */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                                Patient Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Auto-filled after search"
                                value={form.name}
                                onChange={(e) => handleChange("name", e.target.value)}
                                className={`${errors.name ? inputError : inputNormal} text-slate-800`}
                            />
                            {errors.name && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                                Age <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                placeholder="Auto-filled after search"
                                value={form.age}
                                onChange={(e) => handleChange("age", e.target.value)}
                                className={`${errors.age ? inputError : inputNormal} text-slate-800`}
                            />
                            {errors.age && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.age}</p>}
                        </div>
                        <div>
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
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

                    {/* Row 2: Date of Registration, Camp Session, Contact No */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
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
                                    <Calendar size={18} strokeWidth={2.5} />
                                </button>
                                <input
                                    type="date"
                                    ref={dateInputRef}
                                    onChange={handleNativeDateChange}
                                    className="absolute opacity-0 pointer-events-none right-10 top-1/2 -translate-y-1/2"
                                />
                            </div>
                            {errors.regdate && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.regdate}</p>}
                        </div>
                        <div>
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
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
                            {errors.camp_session && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.camp_session}</p>}
                        </div>
                        <div>
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                                Contact No <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Auto-filled after search"
                                value={form.contact}
                                onChange={(e) => handleChange("contact", e.target.value)}
                                className={`${errors.contact ? inputError : inputNormal} text-slate-800`}
                            />
                            {errors.contact && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.contact}</p>}
                        </div>
                    </div>

                    {/* Row 3: Address (spans 3 cols) */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="md:col-span-3">
                            <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                                Address <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Auto-filled after search"
                                value={form.address}
                                onChange={(e) => handleChange("address", e.target.value)}
                                className={`${errors.address ? inputError : inputNormal} text-slate-800`}
                            />
                            {errors.address && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.address}</p>}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4 pt-1">
                        <button
                            type="submit"
                            disabled={loading || !patientFound}
                            className="flex-1 relative overflow-hidden bg-teal-600 hover:bg-teal-700 text-white h-12 rounded-xl transition-all shadow-lg shadow-teal-100 group disabled:opacity-50 active:scale-[0.98]"
                        >
                            <div className="relative flex items-center justify-center gap-3">
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 size={18} strokeWidth={2.5} />
                                        <span className="text-xs font-black uppercase tracking-widest">Register Patient</span>
                                    </>
                                )}
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={handleClear}
                            className="flex items-center justify-center gap-2 px-8 h-12 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all font-black text-xs uppercase tracking-widest"
                        >
                            <RotateCcw size={16} strokeWidth={2.5} />
                            Reset
                        </button>

                        {success && (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-2.5 rounded-xl border border-emerald-200 shadow-sm animate-bounce">
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

export default OldPatientRegistration;
