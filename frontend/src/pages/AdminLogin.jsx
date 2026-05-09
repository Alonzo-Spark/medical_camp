import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, Lock, User, Eye, EyeOff, Loader2, Heart } from "lucide-react";
import cccLogo from "../assets/ccc-logo.png";

const API_BASE = 'http://127.0.0.1:8000/api';

function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState("idle"); // idle, loading, success, error
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setStatus("loading");

        try {
            const res = await axios.post(`${API_BASE}/login`, { username, password });
            if (res.data.status === "success") {
                setStatus("success");
                localStorage.setItem("userRole", res.data.role);
                setTimeout(() => {
                    navigate("/dashboard");
                }, 1000);
            } else {
                setStatus("error");
                setTimeout(() => setStatus("idle"), 3000);
            }
        } catch (err) {
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
            {/* Dynamic Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />

            {/* Login Card */}
            <div className="relative w-full max-w-md px-4 animate-fade-in">
                <div className="glass-panel-light p-10 relative overflow-hidden bg-white/80 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400" />

                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-40 h-40 rounded-full bg-white border-4 border-teal-100 shadow-md mb-6 group transition-all duration-500 hover:shadow-lg hover:border-teal-300 overflow-hidden">
                            <img src={cccLogo} alt="CCC Logo" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Heart size={14} className="text-teal-500" />
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">SWASTH</h1>
                        </div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">MEDICAL CAMP MANAGEMENT SYSTEM</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Username */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                <User size={12} className="text-teal-500" /> Admin Username
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter username"
                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-12 pr-6 py-4 text-slate-800 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-sm"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <Lock size={12} className="text-teal-500" /> Secure Password
                                </label>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-12 pr-12 py-4 text-slate-800 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all shadow-sm"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-teal-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={status === "loading" || status === "success"}
                            className="w-full relative overflow-hidden bg-teal-600 hover:bg-teal-700 text-white h-14 rounded-xl transition-all shadow-lg shadow-teal-100 group disabled:opacity-50 active:scale-[0.98]"
                        >
                            <div className="relative flex items-center justify-center gap-2">
                                {status === "loading" ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : status === "success" ? (
                                    <span className="font-black uppercase tracking-widest text-xs">Access Granted</span>
                                ) : (
                                    <span className="font-black uppercase tracking-widest text-xs">Authorize & Sign In</span>
                                )}
                            </div>
                        </button>
                    </form>

                    {/* Status Messages */}
                    <div className="mt-6 min-h-[20px] text-center">
                        {status === "error" && (
                            <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest animate-bounce">
                                ❌ Credentials Invalid
                            </p>
                        )}
                        {status === "success" && (
                            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                ✅ Redirecting to System...
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <p className="text-center mt-8 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                    HEALTH IS HAPPINESS
                </p>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
}

export default AdminLogin;