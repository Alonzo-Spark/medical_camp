import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, FlaskConical, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

<<<<<<< HEAD
const API_BASE = '/api';
=======
const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`;
>>>>>>> c6659da61c08e3b8d274bc51787783944d4b4306

function IssuedTestsList() {
    const [data, setData] = useState([]);
    const [camps, setCamps] = useState([]);
    const [selectedCamp, setSelectedCamp] = useState('all');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch the data on component mount
    const fetchIssuedTests = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/issued_tests_list`);
            setData(res.data);
        } catch (err) {
            console.error("Error fetching issued tests", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch camps list
    const fetchCamps = async () => {
        try {
            const res = await axios.get(`${API_BASE}/camps`);
            setCamps(res.data);
        } catch (err) {
            console.error("Error fetching camps:", err);
        }
    };

    useEffect(() => {
        fetchIssuedTests();
        fetchCamps();
    }, []);

    // Toggle report issued status
    const handleToggleReportStatus = async (testIssueId, patientId, campSession, newValue) => {
        try {
            await axios.post(`${API_BASE}/update_test_record`, {
                test_issue_id: testIssueId,
                reports_issued: newValue
            });

            // Update local state immutably
            setData(prevData => prevData.map(item => {
                if (item.patient_id === patientId && item.camp_session === campSession) {
                    const updatedTests = item.tests.map(test => {
                        if (test.test_issue_id === testIssueId) {
                            return { ...test, reports_issued: newValue };
                        }
                        return test;
                    });
                    const allIssued = updatedTests.every(test => test.reports_issued);
                    return {
                        ...item,
                        tests: updatedTests,
                        all_reports_issued: allIssued
                    };
                }
                return item;
            }));
        } catch (err) {
            alert('Error updating report status: ' + (err.response?.data?.message || err.message));
        }
    };

    // Filter logic: Filter by camp selection first, then by search query
    const filteredData = data.filter(item => {
        if (selectedCamp !== 'all' && item.camp_session.toString() !== selectedCamp) {
            return false;
        }

        const query = searchQuery.toLowerCase();
        return (
            item.patient_id.toString().includes(query) ||
            item.patient_name.toLowerCase().includes(query) ||
            item.contact_no.includes(query) ||
            item.camp_venue.toLowerCase().includes(query)
        );
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <FlaskConical className="text-teal-600 animate-pulse" size={24} />
                        Issued Laboratory Tests Tracker
                    </h1>
                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">
                        Monitor and manage lab tests issued during medical camps
                    </p>
                </div>

                {/* Sync Button */}
                <button
                    onClick={() => { fetchIssuedTests(); fetchCamps(); }}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-200"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh Registry
                </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Search Input Bar */}
                <div className="relative flex-1 w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Patient ID, Name, Contact Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-sm transition-all"
                    />
                </div>

                {/* Camp Selector Dropdown */}
                <div className="w-full md:w-64">
                    <select
                        value={selectedCamp}
                        onChange={(e) => setSelectedCamp(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-sm transition-all cursor-pointer"
                    >
                        <option value="all">All Camps (Select Camp)</option>
                        {camps.map((camp) => (
                            <option key={camp.id} value={camp.number}>
                                Camp {camp.number} - {camp.venue_name || camp.venue?.name} ({camp.date})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[12px] font-black uppercase tracking-wide text-slate-600">
                                <th className="px-6 py-4">Patient ID</th>
                                <th className="px-6 py-4">Patient Name</th>
                                <th className="px-6 py-4">Contact Number</th>
                                <th className="px-6 py-4">Camp Details</th>
                                <th className="px-6 py-4">Tests Issued</th>
                                <th className="px-6 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-8 w-8 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading test registry...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((item, index) => (
                                    <tr key={index} className="hover:bg-teal-50/20 transition-colors">
                                        {/* Patient ID */}
                                        <td className="px-6 py-5 font-bold font-data text-slate-500 text-sm">
                                            #{item.patient_id}
                                        </td>

                                        {/* Patient Name */}
                                        <td className="px-6 py-5 font-black text-slate-800 text-base">
                                            {item.patient_name}
                                        </td>

                                        {/* Contact Number */}
                                        <td className="px-6 py-5 text-sm font-bold text-slate-600">
                                            {item.contact_no}
                                        </td>

                                        {/* Camp Venue & Session */}
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800">{item.camp_venue}</span>
                                                <span className="text-[10px] font-black text-teal-600 uppercase tracking-wider mt-0.5">Camp #{item.camp_session}</span>
                                            </div>
                                        </td>

                                        {/* Tests List Interactive Checkboxes */}
                                        <td className="px-6 py-5 max-w-md">
                                            <div className="flex flex-row flex-wrap gap-x-4 gap-y-2.5">
                                                {item.tests.map((test) => (
                                                    <label
                                                        key={test.test_issue_id}
                                                        className="flex items-center gap-2 cursor-pointer group animate-fade-in"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={test.reports_issued || false}
                                                            onChange={(e) => handleToggleReportStatus(
                                                                test.test_issue_id,
                                                                item.patient_id,
                                                                item.camp_session,
                                                                e.target.checked
                                                            )}
                                                            className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                                                        />
                                                        <span
                                                            className={`text-xs font-bold transition-all px-2.5 py-1 rounded-lg border ${test.reports_issued
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                    : 'bg-slate-50 text-slate-600 border-slate-200 group-hover:text-slate-800'
                                                                }`}
                                                        >
                                                            {test.test_name}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </td>

                                        {/* Status Check badge */}
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex justify-center">
                                                {item.all_reports_issued ? (
                                                    <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-emerald-100">
                                                        <CheckCircle2 size={12} className="text-emerald-600" />
                                                        Completed
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-amber-100">
                                                        <AlertCircle size={12} className="text-amber-500" />
                                                        Pending Reports
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                                        No patient found with issued tests matching query.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default IssuedTestsList;
