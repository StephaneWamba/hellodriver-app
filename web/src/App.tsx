import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite';
import CGU from './pages/CGU';
import MentionsLegales from './pages/MentionsLegales';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="/cgu" element={<CGU />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
