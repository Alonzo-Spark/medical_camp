import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, FlaskConical, CheckCircle2, AlertCircle, RefreshCw, Phone } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`;
const VOICEBOT_BASE = API_BASE.replace('/api', '');   // e.g. http://localhost:8000

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
function IssuedTestsList() {
    const [data, setData] = useState([]);
    const [camps, setCamps] = useState([]);
    const [selectedCamp, setSelectedCamp] = useState('all');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // callStates keyed by patient_id: null | 'calling' | 'success' | 'error'
    const [callStates, setCallStates] = useState({});

    const fetchIssuedTests = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/issued_tests_list`);
            setData(res.data);
        } catch (err) {
            console.error('Error fetching issued tests', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchCamps = async () => {
        try {
            const res = await axios.get(`${API_BASE}/camps`);
            setCamps(res.data);
        } catch (err) {
            console.error('Error fetching camps:', err);
        }
    };

    useEffect(() => {
        fetchIssuedTests();
        fetchCamps();
    }, []);

    // Automatic polling when there are active/pending voice calls
    useEffect(() => {
        const hasActiveCalls = data.some(
            item => item.call_status === 'pending' || item.call_status === 'in_progress'
        );

        // Reset callStates button loaders for patients whose calls finished
        setCallStates(prev => {
            let changed = false;
            const updated = { ...prev };
            data.forEach(item => {
                const state = prev[item.patient_id];
                if (state && item.call_status !== 'pending' && item.call_status !== 'in_progress') {
                    delete updated[item.patient_id];
                    changed = true;
                }
            });
            return changed ? updated : prev;
        });

        if (!hasActiveCalls) return;

        const intervalId = setInterval(() => {
            fetchIssuedTests(true);
        }, 5000); // Poll every 5 seconds

        return () => {
            clearInterval(intervalId);
        };
    }, [data]);

    // Toggle Test Done status
    const handleToggleTestDoneStatus = async (testIssueId, patientId, campSession, newValue) => {
        try {
            const res = await axios.post(`${API_BASE}/update_test_record`, {
                test_issue_id: testIssueId,
                test_done: newValue,
            });
            const { test_done, reports_issued } = res.data;
            setData(prev =>
                prev.map(item => {
                    if (item.patient_id === patientId && item.camp_session === campSession) {
                        const updatedTests = item.tests.map(t =>
                            t.test_issue_id === testIssueId ? { ...t, test_done, reports_issued } : t
                        );
                        return {
                            ...item,
                            tests: updatedTests,
                            all_reports_issued: updatedTests.every(t => t.reports_issued),
                            all_tests_done: updatedTests.every(t => t.test_done),
                        };
                    }
                    return item;
                })
            );
        } catch (err) {
            alert('Error updating test done status: ' + (err.response?.data?.message || err.message));
        }
    };

    // Single follow-up call per patient — uses the first pending test_issue_id
    // The voicebot asks about ALL tests generically in one call
    const handleFollowupCall = async (item) => {
        const firstPendingTest = item.tests.find(t => !t.test_done);
        if (!firstPendingTest) return;

        setCallStates(prev => ({ ...prev, [item.patient_id]: 'calling' }));
        try {
            await axios.post(
                `${VOICEBOT_BASE}/api/voicebot/trigger-followup/`,
                { test_issue_id: firstPendingTest.test_issue_id }
            );
            setCallStates(prev => ({ ...prev, [item.patient_id]: 'success' }));
            fetchIssuedTests(true); // Trigger silent refresh to update call_status to pending/in_progress
        } catch (err) {
            console.error('Follow-up call failed:', err);
            setCallStates(prev => ({ ...prev, [item.patient_id]: 'error' }));
        }
    };

    const filteredData = data.filter(item => {
        if (selectedCamp !== 'all' && item.camp_session.toString() !== selectedCamp) return false;
        const q = searchQuery.toLowerCase();
        return (
            item.patient_id.toString().includes(q) ||
            item.patient_name.toLowerCase().includes(q) ||
            item.contact_no.includes(q) ||
            item.camp_venue.toLowerCase().includes(q)
        );
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">

            {/* Header */}
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
                <button
                    onClick={() => { fetchIssuedTests(); fetchCamps(); }}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-200"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh Registry
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
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

            {/* Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[12px] font-black uppercase tracking-wide text-slate-600">
                                <th className="px-6 py-4">Patient ID</th>
                                <th className="px-6 py-4">Patient Name</th>
                                <th className="px-6 py-4">Contact Number</th>
                                <th className="px-6 py-4">Camp Details</th>
                                <th className="px-6 py-4">Tests Issued</th>
                                <th className="px-6 py-4 text-center">Status & Follow-up</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-8 w-8 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Loading test registry...
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((item, index) => {
                                    const cs = callStates[item.patient_id] || null;
                                    return (
                                        <tr key={index} className="hover:bg-teal-50/20 transition-colors">

                                            <td className="px-6 py-5 font-bold font-data text-slate-500 text-sm">
                                                #{item.patient_id}
                                            </td>

                                            <td className="px-6 py-5 font-black text-slate-800 text-base">
                                                {item.patient_name}
                                            </td>

                                            <td className="px-6 py-5 text-sm font-bold text-slate-600">
                                                {item.contact_no}
                                            </td>

                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-800">{item.camp_venue}</span>
                                                    <span className="text-[10px] font-black text-teal-600 uppercase tracking-wider mt-0.5">
                                                        Camp #{item.camp_session}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Test pills with Done checkbox */}
                                            <td className="px-6 py-5 max-w-md">
                                                <div className="flex flex-col gap-2">
                                                    {item.tests.map((test) => (
                                                        <div
                                                            key={test.test_issue_id}
                                                            className="flex items-center justify-between gap-3 bg-slate-50/50 p-2 py-1.5 rounded-xl border border-slate-100/80 hover:bg-slate-50 transition-colors"
                                                        >
                                                            <span className="text-xs font-bold text-slate-700 truncate max-w-[130px]" title={test.test_name}>
                                                                {test.test_name}
                                                            </span>
                                                            <div className="flex items-center gap-3">
                                                                {/* Test Done Checkbox */}
                                                                <label className="flex items-center gap-1 cursor-pointer group">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={test.test_done || false}
                                                                        onChange={(e) =>
                                                                            handleToggleTestDoneStatus(
                                                                                test.test_issue_id,
                                                                                item.patient_id,
                                                                                item.camp_session,
                                                                                e.target.checked
                                                                            )
                                                                        }
                                                                        className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                                                                    />
                                                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border transition-colors ${
                                                                        test.test_done
                                                                            ? 'bg-teal-50 text-teal-700 border-teal-100'
                                                                            : 'bg-white text-slate-400 border-slate-200 group-hover:text-slate-600'
                                                                    }`}>
                                                                        Done
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>

                                            {/* Status + single Follow-up Call button per patient */}
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col items-center gap-2">

                                                    {/* Status badge */}
                                                    {item.all_tests_done ? (
                                                        <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-emerald-100">
                                                            <CheckCircle2 size={12} />
                                                            Completed
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-amber-100">
                                                            <AlertCircle size={12} className="text-amber-500" />
                                                            Pending Tests
                                                        </span>
                                                    )}

                                                    {/* Follow-up Call button — ONE per patient, only when pending */}
                                                    {!item.all_tests_done && (
                                                        <button
                                                            onClick={() => handleFollowupCall(item)}
                                                            disabled={cs === 'calling' || cs === 'success'}
                                                            title="Call this patient in Telugu to follow up on all pending tests"
                                                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm
                                                                ${cs === 'calling'
                                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                    : cs === 'success'
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                                                                        : cs === 'error'
                                                                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 cursor-pointer'
                                                                            : 'bg-violet-600 hover:bg-violet-700 text-white border-violet-700 hover:shadow-violet-100 hover:shadow-md cursor-pointer'
                                                                }`}
                                                        >
                                                            {cs === 'calling' ? (
                                                                <>
                                                                    <span className="w-2.5 h-2.5 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin inline-block" />
                                                                    Calling...
                                                                </>
                                                            ) : cs === 'success' ? (
                                                                <>✓ Call Placed</>
                                                            ) : cs === 'error' ? (
                                                                <>✕ Retry Call</>
                                                            ) : (
                                                                <>
                                                                    <Phone size={10} strokeWidth={2.5} />
                                                                    Follow-up Call
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })

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
