import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LivePage from './pages/LivePage';
import IdentitiesPage from './pages/IdentitiesPage';
import InsightsPage from './pages/InsightsPage';

import { StoreProvider } from './context/StoreContext';

function App() {
  return (
    <StoreProvider>
      <Router basename={import.meta.env.BASE_URL}>
      {/* Global shell - Navbar is permanently fixed at the top for ALL pages */}
      <div className="h-screen bg-[#F4F4F1] text-primary flex flex-col font-sans antialiased overflow-hidden">
        <Navbar />

        {/* Page Content area takes the exact remaining height */}
        <div className="flex-1 w-full relative overflow-y-auto">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/identities" element={<IdentitiesPage />} />
            <Route path="/insights" element={<InsightsPage />} />
          </Routes>
        </div>
      </div>
    </Router>
    </StoreProvider>
  );
}

export default App;
