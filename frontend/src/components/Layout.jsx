import React from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  UserCircle,
  Activity,
  Pill,
  Stethoscope,
  Heart,
  LogOut,
  UserPlus,
  ClipboardList,
  PlusSquare,
  LayoutDashboard,
  Users,
  FileText,
  FlaskConical,
  Menu,
  X
} from 'lucide-react';

const SidebarLink = ({ to, icon: Icon, label, active }) => (
  <Link
    to={to}
    className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 group ${active
      ? 'bg-teal-50 text-teal-700 border border-teal-200 shadow-sm'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
  >
    <Icon size={20} strokeWidth={2.5} className={active ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600 group-hover:scale-110 transition-transform'} />
    <span className="font-bold text-[13px] tracking-wide">{label}</span>
    {active && <div className="ml-auto w-2 h-2 rounded-full bg-teal-500" />}
  </Link>
);

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const adminUsername = localStorage.getItem('medicamp_username') || 'User';
  const initials = adminUsername.slice(0, 2).toUpperCase();
  const userRole = localStorage.getItem('userRole') || 'main_admin';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (location.pathname === '/camp-registration' && userRole !== 'main_admin') {
      navigate('/dashboard');
    }
  }, [location.pathname, userRole, navigate]);

  const formatRole = (role) => {
    switch (role) {
      case 'registration_staff': return 'Registration Staff';
      case 'log_vitals_staff': return 'Vitals Staff';
      case 'main_admin': return 'Main Admin';
      case 'medicine_entry_staff': return 'Medicine Entry Staff';
      default: return 'Medical Staff';
    }
  };

  const getPageTitle = () => {
    const path = location.pathname;
    const titles = {
      '/': 'Medicine Dispatch',
      '/dashboard': 'Dashboard',
      '/vitals': 'Log Patient Vitals',
      '/register': 'Patient Registration',
      '/register-old': 'Medical Fulfillment',
      '/patient': 'Patient Profile',
      '/inventory': 'Stock Inventory',
      '/medicine-entry': 'Stock Entry',
      '/camp-registration': 'Camp Registration',
      '/camp-patients': 'Camp Patients List',
      '/doctors': 'Doctors List',
      '/doctor-consultation-log': 'Doctor Consultation Log',
      '/adding-patients': 'Adding Patients',
    };
    return titles[path] || path.replace('/', '').replace('-', ' ');
  };

  return (
    <div className="flex min-h-screen bg-[#f0fdf4] text-slate-800 relative">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-[272px] border-r border-slate-200 p-5 flex flex-col gap-7 bg-white z-50 transition-transform duration-300 md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-1 pt-1 flex items-center justify-between">
          <div className="flex items-center gap-3 bg-gradient-to-br from-teal-600 to-teal-500 p-3.5 rounded-2xl shadow-lg shadow-teal-200 relative overflow-hidden flex-1">
            {/* Medical cross pattern */}
            <div className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8 0h4v8h8v4h-8v8H8v-8H0V8h8z' fill='white' fill-opacity='1'/%3E%3C/svg%3E")`,
                backgroundSize: '20px 20px'
              }}
            />
            <div className="bg-white/25 p-2.5 rounded-xl backdrop-blur-md relative">
              <Stethoscope size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="relative">
              <h1 className="text-xl font-black text-white tracking-tight">
                MEDICAMP
              </h1>
              <p className="text-[9px] font-bold text-white/70 uppercase tracking-[0.2em]">Health System</p>
            </div>
          </div>

          <button
            className="md:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 ml-2"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-1 overflow-y-auto pr-1">
          <p className="px-4 text-[10px] font-extrabold text-teal-600 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
            <Heart size={10} className="text-teal-500" />
            Clinical Menu
          </p>
          <nav className="flex flex-col gap-1">
            {userRole === 'main_admin' && (
              <SidebarLink to="/camp-registration" icon={Stethoscope} label="Camp Registration" active={location.pathname === '/camp-registration'} />
            )}
            {(userRole === 'main_admin' || userRole === 'registration_staff') && (
              <SidebarLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/dashboard'} />
            )}

            {(userRole === 'main_admin' || userRole === 'registration_staff' || userRole === 'log_vitals_staff') && (
              <>
                <SidebarLink to="/camp-patients" icon={Users} label="Camp Patient List" active={location.pathname === '/camp-patients'} />
                {(userRole === 'main_admin' || userRole === 'registration_staff') && (
                  <SidebarLink to="/adding-patients" icon={UserPlus} label="Adding Patients" active={location.pathname === '/adding-patients'} />
                )}
              </>
            )}

            {(userRole === 'main_admin' || userRole === 'log_vitals_staff') && (
              <>
                <SidebarLink to="/vitals" icon={Activity} label="Log Vitals" active={location.pathname === '/vitals'} />
                <SidebarLink to="/doctors" icon={UserCircle} label="Doctors List" active={location.pathname === '/doctors'} />
                <SidebarLink to="/doctor-consultation-log" icon={FileText} label="Doctor Consultation Log" active={location.pathname === '/doctor-consultation-log'} />
                <SidebarLink to="/issued-tests" icon={FlaskConical} label="Issued Tests Tracker" active={location.pathname === '/issued-tests'} />
              </>
            )}

            {(userRole === 'main_admin' || userRole === 'medicine_entry_staff') && (
              <>
                <SidebarLink to="/inventory" icon={Pill} label="Inventory" active={location.pathname === '/inventory'} />
                <SidebarLink to="/medicine-entry" icon={PlusSquare} label="Stock Entry" active={location.pathname === '/medicine-entry'} />
              </>
            )}

            {userRole === 'main_admin' && (
              <SidebarLink
                to="/camp-report"
                icon={ClipboardList}
                label="Camp Reports"
                active={location.pathname === '/camp-report'}
              />
            )}
          </nav>
        </div>

        {/* User Card */}
        <div className="mt-auto p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-teal-400 flex items-center justify-center font-extrabold text-white text-sm shadow-md shadow-teal-200">
              {initials}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-slate-800 capitalize">{adminUsername}</span>
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-[0.15em]">{formatRole(userRole)}</span>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('medicamp_username');
              localStorage.removeItem('userRole');
              navigate('/login');
            }}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold text-slate-400 hover:text-red-500 bg-white rounded-lg transition-all duration-200 border border-slate-200 hover:border-red-200 hover:bg-red-50"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-4 md:px-10 sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0"
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
            <div className="w-1.5 h-6 bg-gradient-to-b from-teal-500 to-teal-400 rounded-full hidden md:block" />
            <h2 className="text-base md:text-lg font-extrabold text-slate-800 tracking-tight truncate">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-6">

          </div>
        </header>

        <div className="px-4 md:px-10 pb-10 h-[calc(100vh-4rem)] overflow-auto">
          <div className="animate-fade-in pt-4">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;

