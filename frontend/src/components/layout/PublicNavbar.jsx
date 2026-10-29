import React, { useState } from 'react';
import { PhoneCall, LogIn, Menu, X } from 'lucide-react';
import { useWebsiteSettings } from '../../context/WebsiteSettingsContext';

export default function PublicNavbar({ activeScreen, setActiveScreen, onOpenLogin, onOpenEnquire, siteSettings: propSettings }) {
  const { settings: contextSettings } = useWebsiteSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const siteSettings = propSettings || contextSettings;

  const handleLoginClick = () => {
    onOpenLogin();
  };

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Logo */}
        <div 
          className="flex items-center cursor-pointer group"
          onClick={() => setActiveScreen('public-home')}
        >
          <img 
            src="/assets/logo.png" 
            alt={`${siteSettings?.generalInfo?.academyName || 'Zoro English Academy'} Logo`} 
            className="h-10 sm:h-11 w-auto object-contain group-hover:scale-105 transition-transform" 
          />
          <div className="ml-2.5 sm:ml-3">
            <div className="text-lg sm:text-xl font-black tracking-tight text-blue-950 leading-none">
              {siteSettings?.generalInfo?.academyName || 'Zoro English Academy'}
            </div>
            <div className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-0.5">
              {siteSettings?.generalInfo?.tagline || 'Learn | Practice | Grow'}
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-600">
          <button 
            onClick={() => setActiveScreen('public-home')}
            className={`hover:text-blue-700 transition-colors cursor-pointer ${activeScreen === 'public-home' ? 'text-blue-700 font-bold' : ''}`}
          >
            Home
          </button>
          <button 
            onClick={() => {
              setActiveScreen('public-home');
              setTimeout(() => {
                const el = document.getElementById('about');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="hover:text-blue-700 transition-colors cursor-pointer"
          >
            About
          </button>
          <button 
            onClick={() => setActiveScreen('public-course')}
            className={`hover:text-blue-700 transition-colors cursor-pointer ${activeScreen === 'public-course' ? 'text-blue-700 font-bold' : ''}`}
          >
            Courses
          </button>
          <button 
            onClick={() => setActiveScreen('public-competition')}
            className={`hover:text-blue-700 transition-colors cursor-pointer ${activeScreen === 'public-competition' ? 'text-blue-700 font-bold' : ''}`}
          >
            Competitions
          </button>
          <button 
            onClick={() => setActiveScreen('public-contact')}
            className={`hover:text-blue-700 transition-colors cursor-pointer ${activeScreen === 'public-contact' ? 'text-blue-700 font-bold' : ''}`}
          >
            Contact
          </button>
        </nav>

        {/* Desktop Action CTAs: Login & Enquire Now */}
        <div className="hidden md:flex items-center space-x-3">
          <button 
            onClick={handleLoginClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Login</span>
          </button>

          <button 
            onClick={onOpenEnquire}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Enquire Now</span>
          </button>
        </div>

        {/* Mobile Actions: Login Button immediately to the LEFT of Hamburger Icon */}
        <div className="flex md:hidden items-center space-x-2">
          <button 
            type="button"
            onClick={handleLoginClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl font-extrabold text-xs shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-3 animate-in slide-in-from-top-2">
          <button
            onClick={() => { setActiveScreen('public-home'); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${activeScreen === 'public-home' ? 'text-blue-700' : 'text-slate-700'}`}
          >
            Home
          </button>
          <button
            onClick={() => {
              setActiveScreen('public-home');
              setMobileMenuOpen(false);
              setTimeout(() => {
                const el = document.getElementById('about');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="block w-full text-left py-2 font-bold text-sm text-slate-700 border-b border-slate-100"
          >
            About
          </button>
          <button
            onClick={() => { setActiveScreen('public-course'); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${activeScreen === 'public-course' ? 'text-blue-700' : 'text-slate-700'}`}
          >
            Courses
          </button>
          <button
            onClick={() => { setActiveScreen('public-competition'); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${activeScreen === 'public-competition' ? 'text-blue-700' : 'text-slate-700'}`}
          >
            Competitions
          </button>
          <button
            onClick={() => {
              setActiveScreen('public-contact');
              setMobileMenuOpen(false);
            }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${activeScreen === 'public-contact' ? 'text-blue-700' : 'text-slate-700'}`}
          >
            Contact
          </button>

          <div className="pt-2">
            <button 
              type="button"
              onClick={() => { onOpenEnquire(); setMobileMenuOpen(false); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-extrabold text-xs shadow flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Enquire Now</span>
            </button>
          </div>
        </div>
      )}

    </header>
  );
}
