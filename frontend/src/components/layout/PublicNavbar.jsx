import React, { useState, useEffect } from 'react';
import { PhoneCall, LogIn, Menu, X } from 'lucide-react';
import { useWebsiteSettings } from '../../context/WebsiteSettingsContext';
import Logo from '../common/Logo';

export default function PublicNavbar({ activeScreen, setActiveScreen, onOpenLogin, onOpenEnquire, siteSettings: propSettings }) {
  const { settings: contextSettings } = useWebsiteSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  const siteSettings = propSettings || contextSettings;
  const isLandingPage = activeScreen === 'public-home';

  useEffect(() => {
    if (!isLandingPage) return;

    const sections = ['home', 'courses', 'competitions', 'about', 'contact'];

    const handleScroll = () => {
      // If near top of page, home is active
      if (window.scrollY < 80) {
        setActiveSection('home');
        return;
      }

      // Check sections based on scroll offset with navbar clearance
      const scrollPosition = window.scrollY + 140;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(sections[i]);
            return;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLandingPage]);

  const scrollToSection = (sectionId) => {
    if (!isLandingPage) {
      if (sectionId === 'courses') {
        setActiveScreen('public-course');
        return;
      }
      if (sectionId === 'competitions') {
        setActiveScreen('public-competition');
        return;
      }
      if (sectionId === 'contact') {
        setActiveScreen('public-contact');
        return;
      }
      // Return to landing page
      setActiveScreen('public-home');
      setTimeout(() => {
        if (sectionId === 'home') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setActiveSection('home');
        } else {
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
      return;
    }

    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveSection('home');
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        setActiveSection(sectionId);
      }
    }
  };

  const isNavActive = (sectionId) => {
    if (isLandingPage) {
      return activeSection === sectionId;
    }
    if (sectionId === 'courses') return activeScreen === 'public-course';
    if (sectionId === 'competitions') return activeScreen === 'public-competition';
    if (sectionId === 'contact') return activeScreen === 'public-contact';
    if (sectionId === 'home') return activeScreen === 'public-home';
    return false;
  };

  const handleLoginClick = () => {
    onOpenLogin();
  };

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Logo */}
        <div 
          className="flex items-center cursor-pointer group"
          onClick={() => scrollToSection('home')}
        >
          <Logo 
            size="w-10 h-10 sm:w-11 sm:h-11"
            className="group-hover:scale-105 transition-transform"
            showText={true}
            academyName={siteSettings?.generalInfo?.academyName || 'Zoro English Academy'}
            tagline={siteSettings?.generalInfo?.tagline || 'Learn | Practice | Grow'}
            textClassName="ml-2.5 sm:ml-3"
          />
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-600">
          <button 
            type="button"
            onClick={() => scrollToSection('home')}
            className={`transition-colors cursor-pointer pb-1 ${isNavActive('home') ? 'text-blue-700 font-extrabold border-b-2 border-blue-700' : 'hover:text-blue-700'}`}
          >
            Home
          </button>
          <button 
            type="button"
            onClick={() => scrollToSection('about')}
            className={`transition-colors cursor-pointer pb-1 ${isNavActive('about') ? 'text-blue-700 font-extrabold border-b-2 border-blue-700' : 'hover:text-blue-700'}`}
          >
            About
          </button>
          <button 
            type="button"
            onClick={() => scrollToSection('courses')}
            className={`transition-colors cursor-pointer pb-1 ${isNavActive('courses') ? 'text-blue-700 font-extrabold border-b-2 border-blue-700' : 'hover:text-blue-700'}`}
          >
            Courses
          </button>
          <button 
            type="button"
            onClick={() => scrollToSection('competitions')}
            className={`transition-colors cursor-pointer pb-1 ${isNavActive('competitions') ? 'text-blue-700 font-extrabold border-b-2 border-blue-700' : 'hover:text-blue-700'}`}
          >
            Competitions
          </button>
          <button 
            type="button"
            onClick={() => scrollToSection('contact')}
            className={`transition-colors cursor-pointer pb-1 ${isNavActive('contact') ? 'text-blue-700 font-extrabold border-b-2 border-blue-700' : 'hover:text-blue-700'}`}
          >
            Contact
          </button>
        </nav>

        {/* Desktop Action CTAs: Login & Enquire Now */}
        <div className="hidden md:flex items-center space-x-3">
          <button 
            type="button"
            onClick={handleLoginClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Login</span>
          </button>

          <button 
            type="button"
            onClick={onOpenEnquire}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Enquire Now</span>
          </button>
        </div>

        {/* Mobile Actions: Login Button immediately to the LEFT of Hamburger Icon */}
        <div className="flex md:hidden items-center space-x-2 shrink-0">
          <button 
            type="button"
            onClick={handleLoginClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-extrabold text-xs shadow-xs transition-all flex items-center space-x-1 cursor-pointer min-h-[38px]"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 focus:outline-none cursor-pointer"
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
            type="button"
            onClick={() => { scrollToSection('home'); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${isNavActive('home') ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => { scrollToSection('about'); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${isNavActive('about') ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}
          >
            About
          </button>
          <button
            type="button"
            onClick={() => { scrollToSection('courses'); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${isNavActive('courses') ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}
          >
            Courses
          </button>
          <button
            type="button"
            onClick={() => { scrollToSection('competitions'); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${isNavActive('competitions') ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}
          >
            Competitions
          </button>
          <button
            type="button"
            onClick={() => { scrollToSection('contact'); setMobileMenuOpen(false); }}
            className={`block w-full text-left py-2 font-bold text-sm border-b border-slate-100 ${isNavActive('contact') ? 'text-blue-700 font-extrabold' : 'text-slate-700'}`}
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
