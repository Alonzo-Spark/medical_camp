import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
// Lazy load pages to improve initial load time, especially for mobile
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Vitals = lazy(() => import('./pages/Vitals'));
const PatientProfile = lazy(() => import('./pages/PatientProfile'));
const Inventory = lazy(() => import('./pages/Inventory'));
const PatientRegistration = lazy(() => import('./pages/PatientRegistration'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const MedicineEntry = lazy(() => import('./pages/MedicineEntry'));
const CampRegistration = lazy(() => import('./pages/CampRegistration'));
const CampPatients = lazy(() => import('./pages/CampPatients'));
const OldPatientRegistration = lazy(() => import('./pages/OldPatientRegistration'));
const DoctorsList = lazy(() => import('./pages/DoctorsList'));
const DoctorReport = lazy(() => import('./pages/DoctorReport'));
const DoctorPatientList = lazy(() => import('./pages/DoctorPatientList'));
const MobileUpload = lazy(() => import('./pages/MobileUpload'));
const CampReport = lazy(() => import('./pages/CampReport'));
const IssuedTestList = lazy(() => import('./pages/IssuedTestList'));
const AddingPatients = lazy(() => import('./pages/AddingPatients'));



// Loading component
const PageLoader = () => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
    <div className="w-12 h-12 border-4 border-What is main.jsx?blue-500/20 border-t-blue-500 rounded-full animate-spin" />
    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] animate-pulse">Loading Application...</p>
  </div>
);


function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Login is the landing page */}
          <Route path="/" element={<AdminLogin />} />
          <Route path="/login" element={<AdminLogin />} />

          {/* Protected routes wrapped in Layout */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/vitals" element={<Vitals />} />
            <Route path="/patient" element={<PatientProfile />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/register" element={<PatientRegistration />} />
            <Route path="/register-old" element={<OldPatientRegistration />} />
            <Route path="/medicine-entry" element={<MedicineEntry />} />
            <Route path="/camp-registration" element={<CampRegistration />} />
            <Route path="/camp-patients" element={<CampPatients />} />
            <Route path="/doctors" element={<DoctorsList />} />
            <Route path="/doctor-consultation-log" element={<DoctorReport />} />
            <Route path="/doctor-patient-list" element={<DoctorPatientList />} />
            <Route path="/camp-report" element={<CampReport />} />
            <Route path="/issued-tests" element={<IssuedTestList />} />
            <Route path="/adding-patients" element={<AddingPatients />} />
          </Route>

          {/* Mobile scan upload - no layout */}
          <Route path="/mobile-upload/:sessionId" element={<MobileUpload />} />
        </Routes>
      </Suspense>

    </Router>
  );
}

export default App;

