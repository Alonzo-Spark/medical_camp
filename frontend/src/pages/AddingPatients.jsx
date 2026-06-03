import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, ScanLine, Upload, X, Trash2, PlusSquare,
  CheckCircle2, AlertTriangle, Loader2, Save, FileSpreadsheet,
  AlertCircle, Edit2, Check
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api`;

function AddingPatients() {
  const [camps, setCamps] = useState([]);
  const [targetCampId, setTargetCampId] = useState('');

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Scan states
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanSessionId, setScanSessionId] = useState(null);
  const [scanStatus, setScanStatus] = useState({ is_completed: false, ocr_status: 'pending' });
  const [localFile, setLocalFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [serverIp, setServerIp] = useState('192.168.0.32');

  const pollIntervalRef = useRef(null);

  // Load camps
  useEffect(() => {
    axios.get(`${API_BASE}/camps`)
      .then(res => {
        setCamps(res.data);
        if (res.data.length > 0) {
          // Default target camp to camp 23 if it exists, otherwise the latest
          const camp23 = res.data.find(c => c.number === 23);
          if (camp23) {
            setTargetCampId(camp23.number);
          } else {
            setTargetCampId(res.data[res.data.length - 1].number);
          }
        }
      })
      .catch(err => console.error("Error loading camps:", err));

    axios.get(`${API_BASE}/get_server_ip`)
      .then(res => {
        if (res.data && res.data.ip) {
          setServerIp(res.data.ip);
        }
      })
      .catch(err => console.error("Error loading server IP:", err));
  }, []);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Initialize scan session
  const startScanSession = async () => {
    try {
      setErrorMsg('');
      const res = await axios.post(`${API_BASE}/create_scan_session`);
      if (res.data.status === 'success') {
        setScanSessionId(res.data.session_id);
        setScanStatus({ is_completed: false, ocr_status: 'pending' });
        setShowScanModal(true);
        startPolling(res.data.session_id);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to initialize scan session.');
    }
  };

  // Poll for scan completion
  const startPolling = (sessionId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/check_scan_status/${sessionId}`);
        if (res.data.ocr_status === 'completed' || res.data.is_completed) {
          clearInterval(pollIntervalRef.current);
          setScanStatus({ is_completed: true, ocr_status: 'completed' });
          triggerOcrProcessing(sessionId);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
  };

  const getCampDate = (campNum) => {
    const camp = camps.find(c => c.number === parseInt(campNum));
    if (camp && camp.date) {
      if (camp.date.includes('-')) {
        const [y, m, d] = camp.date.split('-');
        return `${d}/${m}/${y}`;
      }
      return camp.date;
    }
    return '';
  };

  // Trigger custom Patient List OCR processing
  const triggerOcrProcessing = async (sessionId) => {
    setOcrLoading(true);
    setShowScanModal(false);
    try {
      const res = await axios.post(`${API_BASE}/ocr_patient_list`, { session_id: sessionId });
      if (res.data.status === 'success') {
        const parsedPatients = res.data.patients.map(p => {
          const oldNew = p.old_or_new || (p.exists_in_db ? 'Old' : 'New');
          return {
            ...p,
            old_or_new: oldNew
          };
        });
        setPatients(parsedPatients);
        setSuccessMsg('OCR Scan completed! Please review and modify details below.');
      } else {
        setErrorMsg(res.data.message || 'OCR parsing failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error processing patient list OCR.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Local file upload fallback
  const handleLocalUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    setShowScanModal(false);
    try {
      // 1. Create session
      const sessRes = await axios.post(`${API_BASE}/create_scan_session`);
      const sId = sessRes.data.session_id;

      // 2. Upload file
      const formData = new FormData();
      formData.append('image', file);
      await axios.post(`${API_BASE}/upload_scan/${sId}`, formData);

      // 3. Trigger OCR
      triggerOcrProcessing(sId);
    } catch (err) {
      console.error(err);
      setErrorMsg('Local file upload failed.');
      setOcrLoading(false);
    }
  };

  // Table row editing
  const handleCellChange = (index, field, value) => {
    const updated = [...patients];
    updated[index][field] = value;
    setPatients(updated);
  };

  const handleTypeChange = (index, value) => {
    const updated = [...patients];
    updated[index].old_or_new = value;
    setPatients(updated);
  };

  const handleTargetCampChange = (newCampId) => {
    setTargetCampId(newCampId);
  };

  // Check ID existence in database
  const handleIdBlur = async (index, pid) => {
    if (!pid) return;
    try {
      const res = await axios.get(`${API_BASE}/check_patient_id/${pid}`);
      const updated = [...patients];
      const exists = res.data.exists && !res.data.is_skeleton;
      updated[index].exists_in_db = exists;
      setPatients(updated);
    } catch (err) {
      console.error("ID validation error:", err);
    }
  };

  // Add empty row
  const addRow = () => {
    setPatients([
      ...patients,
      {
        patient_id: '',
        name: '',
        gender: '',
        age: '',
        address: '',
        contact_no: '',
        old_or_new: 'New',
        exists_in_db: false
      }
    ]);
  };

  // Delete row
  const deleteRow = (index) => {
    setPatients(patients.filter((_, idx) => idx !== index));
  };

  // Submit batch
  const handleSubmitBatch = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    // Client-side validations
    const invalidRow = patients.some(p => !p.patient_id || !p.name || !p.age);
    if (invalidRow) {
      setErrorMsg('Please ensure all patients have an ID, Name, and Age.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/bulk_add_patients`, {
        patients: patients,
        camp_number: targetCampId
      });

      if (res.data.status === 'success') {
        setSuccessMsg(res.data.message);
        setPatients([]); // clear review grid on success
      } else {
        setErrorMsg(res.data.message || 'Submission failed.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Error processing batch upload.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-slate-800";

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">

      {/* Top Configuration Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-400" />

        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
            <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Rapid Import</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">Bulk Add Patients</h3>
          <p className="text-slate-400 text-xs font-bold mt-1">Scan handwritten sheets or enter records directly</p>
        </div>

        {/* Camp Settings Selector */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Target Camp</label>
            <select
              value={targetCampId}
              onChange={(e) => handleTargetCampChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            >
              {camps.map(camp => (
                <option key={camp.id} value={camp.number}>Camp {camp.number} - {camp.venue}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={startScanSession}
          className="flex items-center gap-2.5 px-6 h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all shadow-md shadow-teal-100 font-extrabold text-xs uppercase tracking-wider"
        >
          <QrCode size={18} />
          Scan Handwritten List
        </button>

        <button
          onClick={addRow}
          className="flex items-center gap-2.5 px-6 h-12 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all font-extrabold text-xs uppercase tracking-wider"
        >
          <PlusSquare size={18} />
          Add Blank Row
        </button>
      </div>

      {/* Message Notifications */}
      {successMsg && (
        <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 border border-emerald-200 px-5 py-4 rounded-xl shadow-sm">
          <CheckCircle2 size={20} className="shrink-0" />
          <p className="text-xs font-bold leading-relaxed">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 text-red-700 bg-red-50 border border-red-200 px-5 py-4 rounded-xl shadow-sm">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* OCR Processing Loader */}
      {ocrLoading && (
        <div className="bg-white border border-slate-200 p-12 rounded-2xl flex flex-col items-center justify-center gap-4 shadow-sm">
          <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
          <p className="text-slate-800 font-black text-sm uppercase tracking-wider">Processing Scan with AI Vision...</p>
          <p className="text-slate-400 text-xs font-bold">This usually takes about 5-10 seconds.</p>
        </div>
      )}

      {/* Review & Edit Grid */}
      {patients.length > 0 && !ocrLoading && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-teal-600" />
              Review Extracted Patients List ({patients.length})
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-12 text-center">Action</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-40">Status</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-32">Type</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-24">Patient ID *</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Name *</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-20">Age *</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-28">Gender</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-36">Contact No</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">

                    {/* Delete Row */}
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => deleteRow(idx)}
                        className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>

                    {/* DB Status Badge */}
                    <td className="px-4 py-2">
                      {p.exists_in_db ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200/60 select-none">
                          Exists in DB
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/60 select-none">
                          Not in DB
                        </span>
                      )}
                    </td>

                    {/* Patient Type select dropdown */}
                    <td className="px-4 py-2">
                      <select
                        value={p.old_or_new || 'New'}
                        onChange={(e) => handleTypeChange(idx, e.target.value)}
                        className={inputClass}
                      >
                        <option value="New">New</option>
                        <option value="Old">Old</option>
                      </select>
                    </td>

                    {/* Patient ID */}
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={p.patient_id}
                        onBlur={(e) => handleIdBlur(idx, e.target.value)}
                        onChange={(e) => handleCellChange(idx, 'patient_id', e.target.value)}
                        className={inputClass}
                        placeholder="ID"
                      />
                    </td>

                    {/* Patient Name */}
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleCellChange(idx, 'name', e.target.value)}
                        className={inputClass}
                        placeholder="Full Name"
                      />
                    </td>

                    {/* Age */}
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="any"
                        value={p.age}
                        onChange={(e) => handleCellChange(idx, 'age', e.target.value)}
                        className={inputClass}
                        placeholder="Age"
                      />
                    </td>

                    {/* Gender */}
                    <td className="px-4 py-2">
                      <select
                        value={p.gender}
                        onChange={(e) => handleCellChange(idx, 'gender', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </td>

                    {/* Contact Number */}
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={p.contact_no}
                        onChange={(e) => handleCellChange(idx, 'contact_no', e.target.value)}
                        className={inputClass}
                        placeholder="Contact"
                      />
                    </td>

                    {/* Address */}
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={p.address}
                        onChange={(e) => handleCellChange(idx, 'address', e.target.value)}
                        className={inputClass}
                        placeholder="Address"
                      />
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Submit Actions */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4">
            <button
              onClick={() => setPatients([])}
              className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all font-black text-[11px] uppercase tracking-wider"
            >
              Clear Grid
            </button>
            <button
              onClick={handleSubmitBatch}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl transition-all font-black text-[11px] uppercase tracking-wider shadow-md shadow-teal-100"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Save {patients.length} Patients
            </button>
          </div>
        </div>
      )}

      {/* Floating QR Code Scanner Modal */}
      {showScanModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200/80 shadow-2xl overflow-hidden animate-scale-in">

            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-teal-600" />
                <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Scan Physical Sheet</h4>
              </div>
              <button
                onClick={() => setShowScanModal(false)}
                className="p-1.5 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-8 flex flex-col items-center">
              <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 mb-6 shadow-inner">
                {scanSessionId && (
                  <QRCodeSVG
                    value={`http://${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? serverIp : window.location.hostname}:5173/mobile-upload/${scanSessionId}`}
                    size={180}
                    level="H"
                    includeMargin={true}
                  />
                )}
              </div>

              <p className="text-center text-slate-800 font-extrabold text-sm mb-1">Scan with Mobile Phone</p>
              <p className="text-center text-slate-400 text-xs font-bold max-w-[240px] leading-relaxed mb-6">
                Scan this QR code using your phone's camera to snap and upload the patient list document.
              </p>

              <div className="flex items-center gap-2 text-[10px] font-black text-teal-600 bg-teal-50 px-4 py-2 rounded-full uppercase tracking-widest animate-pulse">
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                Waiting for mobile upload...
              </div>

              <div className="w-full flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">OR</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <label className="w-full flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-teal-50/20 hover:border-teal-300 transition-all cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLocalUpload}
                  className="hidden"
                />
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-teal-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black text-slate-600 group-hover:text-teal-700">Upload Local Image File</span>
              </label>

            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

export default AddingPatients;
