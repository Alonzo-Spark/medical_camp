import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Camera, CheckCircle2, AlertCircle, Upload, Loader2 } from 'lucide-react';

const API_BASE = 'http://' + window.location.hostname + ':8000/api';

const MobileUpload = () => {
    const { sessionId } = useParams();
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, success, error
    const [errorMsg, setErrorMsg] = useState('');

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setStatus('idle');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await axios.post(`${API_BASE}/upload_scan/${sessionId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (res.data.status === 'success') {
                setStatus('success');
            } else {
                setStatus('error');
                setErrorMsg(res.data.message || 'Upload failed');
            }
        } catch (err) {
            setStatus('error');
            setErrorMsg(err.response?.data?.message || 'Server connection error');
        } finally {
            setUploading(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-emerald-100 border border-emerald-100 animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-emerald-200">
                        <CheckCircle2 size={40} strokeWidth={3} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Upload Successful</h2>
                    <p className="text-slate-500 font-bold mb-8">The patient report has been securely transmitted to the dashboard.</p>
                    <button 
                        onClick={() => { setStatus('idle'); setFile(null); setPreview(null); }}
                        className="w-full bg-slate-800 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
                    >
                        Scan Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col p-6">
            <header className="mb-10 pt-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-teal-500 rounded-lg text-white">
                        <Camera size={20} strokeWidth={2.5} />
                    </div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Mobile Scanner</h1>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Document Session: {sessionId.split('-')[0]}...</p>
            </header>

            <main className="flex-1 flex flex-col gap-6">
                {!preview ? (
                    <label className="flex-1 flex flex-col items-center justify-center bg-white border-4 border-dashed border-slate-200 rounded-3xl p-10 cursor-pointer hover:border-teal-500/50 hover:bg-teal-50/10 transition-all active:scale-[0.98]">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
                            <Camera size={32} />
                        </div>
                        <span className="text-slate-800 font-black text-center mb-2">Capture Report</span>
                        <span className="text-slate-400 text-xs font-bold text-center">Tap to open camera</span>
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={handleFileChange}
                        />
                    </label>
                ) : (
                    <div className="flex-1 flex flex-col gap-4 animate-in fade-in duration-500">
                        <div className="relative flex-1 rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-black">
                            <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                            <button 
                                onClick={() => { setFile(null); setPreview(null); }}
                                className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white p-2 rounded-full"
                            >
                                <Camera size={20} />
                            </button>
                        </div>
                        
                        {status === 'error' && (
                            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-600 animate-shake">
                                <AlertCircle size={18} />
                                <p className="text-xs font-bold">{errorMsg}</p>
                            </div>
                        )}

                        <button 
                            onClick={handleUpload}
                            disabled={uploading}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-teal-100 disabled:opacity-50 flex items-center justify-center gap-3 transition-all active:scale-95"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload size={20} strokeWidth={3} />
                                    Submit to Dashboard
                                </>
                            )}
                        </button>
                    </div>
                )}
            </main>

            <footer className="mt-10 py-6 border-t border-slate-200">
                <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Medical Camp • Secure Transmission</p>
            </footer>
        </div>
    );
};

export default MobileUpload;
