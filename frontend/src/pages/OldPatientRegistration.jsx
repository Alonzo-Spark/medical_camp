import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { UserCheck, Save, RotateCcw, ArrowLeft, Heart, Calendar, MapPin, Phone, User, Landmark, Hash, CheckCircle2, AlertTriangle, Search } from "lucide-react";

const API_BASE = 'http://127.0.0.1:8000/api';

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
                const [y, m, d] = latestCamp.date.split('-');
                const formattedDate = `${d}/${m}/${y}`;

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
                const patient = patientRes.data;
                setOriginalPatient(patient);
                setForm(prev => ({
                    ...prev,
                    name: patient.name || "",
                    age: patient.age ? String(patient.age) : "",
                    gender: patient.gender || "",
                    contact: patient.contact || "",
                    address: patient.address || "",
                }));
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
        if (!form.contact) { newErrors.contact = "Required"; valid = false; }
        if (!form.address) { newErrors.address = "Required"; valid = false; }

        setErrors(newErrors);
        if (!valid) return;

        setLoading(true);
        try {
            await axios.post(`${API_BASE}/register_patient`, { 
                pid: form.pid,
                name: form.name,
                age: form.age,
                gender: form.gender,
                contact: form.contact,
                address: form.address
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
        <div className="max-w-5xl mx-auto py-4">
            <div className="glass-panel-light p-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400" />

                <div className="mb-10">
                    <div className="flex items-center gap-2 mb-1">
                        <Heart size={14} className="text-teal-500" />
                        <p className="text-teal-600 text-[10px] font-extrabold uppercase tracking-[0.25em]">Returning Patient</p>
                    </div>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                            <UserCheck size={24} className="text-amber-600" strokeWidth={2.5} />
                        </div>
                        Register Old Patient
                    </h3>
                    <p className="text-slate-400 text-sm font-bold mt-2 ml-[52px]">Re-register existing patients for a new camp session</p>
                </div>

                <form id="old-patient-registration-form" onSubmit={handleSubmit} className="space-y-8">
                    {/* Patient Search Section */}
                    <div className="p-6 bg-amber-50/50 rounded-xl border border-amber-100">
                        <h4 className="text-[11px] font-extrabold text-amber-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                            Search Patient
                        </h4>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Patient ID <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Enter existing Patient ID"
                                        value={form.pid}
                                        onChange={(e) => handleChange("pid", e.target.value)}
                                        className={`${errors.pid ? inputError : inputNormal} text-slate-800 pr-12`}
                                    />
                                    {searchLoading && (
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                                        </span>
                                    )}
                                </div>
                                {errors.pid && (
                                    <p className="text-red-500 text-[11px] mt-2 font-bold flex items-center gap-1.5">
                                        <AlertTriangle size={12} /> {errors.pid}
                                    </p>
                                )}
                                {patientFound && (
                                    <p className="text-emerald-600 text-[11px] mt-2 font-bold flex items-center gap-1.5">
                                        <CheckCircle2 size={12} /> Patient found! Details auto-filled below.
                                    </p>
                                )}
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={handleSearchPatient}
                                    disabled={searchLoading}
                                    className="flex items-center justify-center gap-2 px-8 h-[54px] bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-100 disabled:opacity-50 active:scale-[0.98]"
                                >
                                    <Search size={16} strokeWidth={2.5} />
                                    Search
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Patient Identity - Read Only */}
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-[11px] font-extrabold text-teal-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                            Patient Identity
                        </h4>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Patient Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Auto-filled after search"
                                    value={form.name}
                                    onChange={(e) => handleChange("name", e.target.value)}
                                    className={`${errors.name ? inputError : inputNormal} text-slate-800`}
                                />
                                {errors.name && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Age <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="number"
                                    placeholder="Auto-filled after search"
                                    value={form.age}
                                    onChange={(e) => handleChange("age", e.target.value)}
                                    className={`${errors.age ? inputError : inputNormal} text-slate-800`}
                                />
                                {errors.age && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.age}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Demographics */}
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-[11px] font-extrabold text-teal-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                            Demographics
                        </h4>
                        <div className="grid md:grid-cols-2 gap-6">
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
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Contact No <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Auto-filled after search"
                                    value={form.contact}
                                    onChange={(e) => handleChange("contact", e.target.value)}
                                    className={`${errors.contact ? inputError : inputNormal} text-slate-800`}
                                />
                                {errors.contact && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.contact}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-[11px] font-extrabold text-teal-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-teal-500 rounded-full" />
                            Contact Information
                        </h4>
                        <div className="grid md:grid-cols-1 gap-6">
                            <div>
                                <label className="block text-[12px] font-extrabold text-slate-600 uppercase tracking-wide mb-2.5">
                                    Address <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Auto-filled after search"
                                    value={form.address}
                                    onChange={(e) => handleChange("address", e.target.value)}
                                    className={`${errors.address ? inputError : inputNormal} text-slate-800`}
                                />
                                {errors.address && <p className="text-red-500 text-[11px] mt-2 font-bold">{errors.address}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Camp & Registration */}
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

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4 pt-2">
                        <button
                            type="submit"
                            disabled={loading || !patientFound}
                            className="flex-1 relative overflow-hidden bg-amber-600 hover:bg-amber-700 text-white h-14 rounded-xl transition-all shadow-lg shadow-amber-100 group disabled:opacity-50 active:scale-[0.98]"
                        >
                            <div className="relative flex items-center justify-center gap-3">
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <UserCheck size={18} strokeWidth={2.5} />
                                        <span className="text-xs font-black uppercase tracking-widest">Register</span>
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
                                <span className="text-xs font-black uppercase tracking-widest">Registered Successfully</span>
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

export default OldPatientRegistration;
