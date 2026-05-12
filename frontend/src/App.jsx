import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Vitals from './pages/Vitals';
import PatientProfile from './pages/PatientProfile';
import Inventory from './pages/Inventory';
import PatientRegistration from './pages/PatientRegistration';
import AdminLogin from './pages/AdminLogin';
import MedicineEntry from './pages/MedicineEntry';
import CampRegistration from './pages/CampRegistration';
import CampPatients from './pages/CampPatients';
import OldPatientRegistration from './pages/OldPatientRegistration';
import DoctorsList from './pages/DoctorsList';

function App() {
  return (
    <Router>
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
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
