import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, LayoutDashboard, UserSearch, UserPlus, UserCheck, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      {/* Header */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart size={14} className="text-teal-500" />
          <p className="text-teal-600 text-[10px] font-extrabold uppercase tracking-[0.25em]">Patient Management</p>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200">
            <LayoutDashboard className="text-teal-600" size={24} strokeWidth={2.5} />
          </div>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard</h3>
        </div>
        <p className="text-slate-400 text-sm font-bold ml-[52px]">Select an option to continue</p>
      </div>

      {/* Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">

        {/* Existing Patient Card */}
        <button
          onClick={() => navigate('/patient')}
          className="group relative overflow-hidden text-left glass-panel-light p-8 hover:border-teal-300 transition-all duration-300 hover:shadow-xl hover:shadow-teal-100/50 active:scale-[0.98]"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-400 to-violet-400" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative space-y-5">
            <div className="flex items-center justify-between">
              <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 shadow-sm group-hover:shadow-md group-hover:shadow-blue-100 transition-all">
                <UserSearch size={28} className="text-blue-600" strokeWidth={2} />
              </div>
              <div className="p-2 bg-slate-50 rounded-full text-slate-300 group-hover:text-blue-500 group-hover:bg-blue-50 group-hover:translate-x-1 transition-all duration-300">
                <ArrowRight size={20} strokeWidth={2.5} />
              </div>
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-800 tracking-tight mb-1.5 group-hover:text-blue-700 transition-colors">
                Existing Patient
              </h4>
              <p className="text-sm text-slate-400 font-bold leading-relaxed">
                Search and view patient profiles, medical history and past records
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              <span>Open Patient Profile</span>
              <ArrowRight size={12} strokeWidth={3} />
            </div>
          </div>
        </button>

        {/* Register New Patient Card */}
        <button
          onClick={() => navigate('/register')}
          className="group relative overflow-hidden text-left glass-panel-light p-8 hover:border-teal-300 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/50 active:scale-[0.98]"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-green-400 to-teal-400" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative space-y-5">
            <div className="flex items-center justify-between">
              <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-100 shadow-sm group-hover:shadow-md group-hover:shadow-emerald-100 transition-all">
                <UserPlus size={28} className="text-emerald-600" strokeWidth={2} />
              </div>
              <div className="p-2 bg-slate-50 rounded-full text-slate-300 group-hover:text-emerald-500 group-hover:bg-emerald-50 group-hover:translate-x-1 transition-all duration-300">
                <ArrowRight size={20} strokeWidth={2.5} />
              </div>
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-800 tracking-tight mb-1.5 group-hover:text-emerald-700 transition-colors">
                Register New Patient
              </h4>
              <p className="text-sm text-slate-400 font-bold leading-relaxed">
                Register a new patient with personal details, contact info and camp session
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              <span>Open Registration Form</span>
              <ArrowRight size={12} strokeWidth={3} />
            </div>
          </div>
        </button>

        {/* Register Old Patient Card */}
        <button
          onClick={() => navigate('/register-old')}
          className="group relative overflow-hidden text-left glass-panel-light p-8 hover:border-amber-300 transition-all duration-300 hover:shadow-xl hover:shadow-amber-100/50 active:scale-[0.98]"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400" />
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50/0 to-teal-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative space-y-5">
            <div className="flex items-center justify-between">
              <div className="p-3.5 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border border-teal-100 shadow-sm group-hover:shadow-md group-hover:shadow-teal-100 transition-all">
                <UserCheck size={28} className="text-teal-600" strokeWidth={2} />
              </div>
              <div className="p-2 bg-slate-50 rounded-full text-slate-300 group-hover:text-teal-500 group-hover:bg-teal-50 group-hover:translate-x-1 transition-all duration-300">
                <ArrowRight size={20} strokeWidth={2.5} />
              </div>
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-800 tracking-tight mb-1.5 group-hover:text-teal-700 transition-colors">
                Medical Fulfillment
              </h4>
              <p className="text-sm text-slate-400 font-bold leading-relaxed">
                Re-verify and register returning patients for the current camp session
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-black text-teal-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              <span>Open Fulfillment Form</span>
              <ArrowRight size={12} strokeWidth={3} />
            </div>
          </div>
        </button>

      </div>
    </div>
  );
};

export default Dashboard;
