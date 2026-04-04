import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/common/BottomNav';
import Home from './pages/Home';
import FindSisters from './pages/FindSisters';
import LifeGallery from './pages/LifeGallery';
import BusinessMatch from './pages/BusinessMatch';
import NewsEvents from './pages/NewsEvents';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if API is available
    fetch('/api/health')
      .catch(() => console.log('API not available, using mock data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在載入應用...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container bg-gray-50">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/find-sisters" element={<FindSisters />} />
        <Route path="/life-gallery" element={<LifeGallery />} />
        <Route path="/business-match" element={<BusinessMatch />} />
        <Route path="/news-events" element={<NewsEvents />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

export default App;
