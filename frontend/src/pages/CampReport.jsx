import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Users, UserPlus, History, Stethoscope,
    Pill, ClipboardList, Calendar, MapPin,
    TrendingUp, Download, Banknote
} from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:8000/api`;

const StatCard = ({ title, value, subValue, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
                <Icon size={24} />
            </div>
            <div className="text-right">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                <h3 className="text-3xl font-black text-slate-800">{value}</h3>
            </div>
        </div>
        {subValue && (
            <div className="pt-4 border-t border-slate-50">
                <p className="text-xs font-bold text-slate-400">{subValue}</p>
            </div>
        )}
    </div>
);

const CampReport = () => {
    const [camps, setCamps] = useState([]);
    const [selectedCamp, setSelectedCamp] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    // 1. Fetch the list of camps for the dropdown
    useEffect(() => {
        axios.get(`${API_BASE}/camps`).then(res => {
            setCamps(res.data);
            if (res.data.length > 0) setSelectedCamp(res.data[0].number);
        });
    }, []);

    // 2. Fetch the report data whenever the selected camp changes
    useEffect(() => {
        if (selectedCamp) {
            setLoading(true);
            axios.get(`${API_BASE}/camp_report/${selectedCamp}`)
                .then(res => {
                    setReportData(res.data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [selectedCamp]);

    if (!reportData && loading) return <div className="p-10 text-center font-bold">Generating Report...</div>;

    return (
        <div className="space-y-8">
            {/* Header & Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <TrendingUp className="text-teal-500" />
                        Executive Camp Summary
                    </h1>
                    <p className="text-slate-500 font-medium">Detailed clinical and inventory analytics</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <select
                        value={selectedCamp}
                        onChange={(e) => setSelectedCamp(e.target.value)}
                        className="flex-1 md:w-64 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:border-teal-500 transition-colors"
                    >
                        {camps.map(camp => (
                            <option key={camp.number} value={camp.number}>
                                Camp {camp.number} - {camp.venue_name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => window.open(`http://${window.location.hostname}:8000/export_camp_report/${selectedCamp}`)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-teal-100"
                    >
                        <Download size={16} />
                        Download Report
                    </button>
                </div>
            </div>

            {reportData && (
                <>
                    {/* Session Info Bar (Above all) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-teal-600 p-6 rounded-2xl shadow-lg shadow-teal-100 text-white">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-white/20"><MapPin size={24} /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Venue</p>
                                <p className="font-black text-lg">{reportData.venue}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-white/20"><Calendar size={24} /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Date</p>
                                <p className="font-black text-lg">{new Date(reportData.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                        </div>

                    </div>

                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {/* ENHANCED: Total Patients Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                                    <Users size={24} />
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Patients</p>
                                    <h3 className="text-3xl font-black text-slate-800">{reportData.patients.total}</h3>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-4 border-t border-slate-50">
                                <div className="flex-1 bg-blue-50/50 p-2 rounded-lg text-center">
                                    <p className="text-[10px] font-black text-blue-600 uppercase">New</p>
                                    <p className="font-black text-blue-800 text-lg">{reportData.patients.new}</p>
                                </div>
                                <div className="flex-1 bg-slate-50 p-2 rounded-lg text-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase">Old</p>
                                    <p className="font-black text-slate-700 text-lg">{reportData.patients.old}</p>
                                </div>
                            </div>
                        </div>

                        {/* ENHANCED: Medicine Inventory Dashboard */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-xl bg-teal-50 text-teal-600">
                                    <Pill size={24} />
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Overall Medicine</p>
                                    <h3 className="text-3xl font-black text-slate-800">{reportData.medicine.used} <span className="text-sm font-bold text-slate-400">Used</span></h3>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
                                <div className="bg-teal-50/50 p-2 rounded-lg text-center">
                                    <p className="text-[10px] font-black text-teal-600 uppercase">Allocated</p>
                                    <p className="font-black text-teal-800 text-lg">{reportData.medicine.allocated}</p>
                                </div>
                                <div className="bg-orange-50/50 p-2 rounded-lg text-center">
                                    <p className="text-[10px] font-black text-orange-600 uppercase">Used</p>
                                    <p className="font-black text-orange-800 text-lg">{reportData.medicine.used}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg text-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase">Remaining</p>
                                    <p className="font-black text-slate-700 text-lg">{reportData.medicine.remaining}</p>
                                </div>
                            </div>
                        </div>

                        <StatCard
                            title="Total Cost"
                            value={reportData.medicine.total_cost !== undefined ? `₹ ${Number(reportData.medicine.total_cost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹ 0.00'}
                            subValue="Estimated value of medicines used"
                            icon={Banknote}
                            color="emerald"
                        />

                        <StatCard
                            title="Doctors On Duty"
                            value={reportData.doctors.count}
                            subValue={reportData.doctors.names.join(', ')}
                            icon={Stethoscope}
                            color="purple"
                        />
                        <StatCard
                            title="Tests Conducted"
                            value={reportData.tests.total_issued}
                            subValue="Lab investigation requests"
                            icon={ClipboardList}
                            color="orange"
                        />
                    </div>

                    {/* Attendance Breakdown Bar Chart */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 className="font-black text-slate-800 text-lg border-b pb-4 mb-6 text-center">Attendance Breakdown</h3>
                        <div className="flex flex-col md:flex-row items-center gap-12 h-auto md:h-40">
                            <div className="flex-1 w-full space-y-2">
                                <div className="flex justify-between text-sm font-bold">
                                    <span className="text-blue-600">New Registrations ({reportData.patients.new})</span>
                                    <span>{reportData.patients.total > 0 ? Math.round((reportData.patients.new / reportData.patients.total) * 100) : 0}%</span>
                                </div>
                                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${reportData.patients.total > 0 ? (reportData.patients.new / reportData.patients.total) * 100 : 0}%` }} />
                                </div>
                            </div>
                            <div className="flex-1 w-full space-y-2">
                                <div className="flex justify-between text-sm font-bold">
                                    <span className="text-slate-500">Returning Patients ({reportData.patients.old})</span>
                                    <span>{reportData.patients.total > 0 ? Math.round((reportData.patients.old / reportData.patients.total) * 100) : 0}%</span>
                                </div>
                                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${reportData.patients.total > 0 ? (reportData.patients.old / reportData.patients.total) * 100 : 0}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
};

export default CampReport;
