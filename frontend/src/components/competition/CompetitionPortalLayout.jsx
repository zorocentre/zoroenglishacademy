import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  Trophy, BookOpen, FileText, Layers, Target, Award, BarChart2, 
  Menu, X, ChevronDown, GraduationCap, ArrowLeftRight, LogOut,
  Calendar, User, AlertTriangle, Clock, Info, CheckSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMyPortals } from '../../api/competitionApi';
import { resolveFileUrl } from '../../api/fileApi';
import PageLoader from '../common/PageLoader';

export default function CompetitionPortalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [portals, setPortals] = useState({ learning: false, competition: false, competitions: [] });
  const [currentCompetition, setCurrentCompetition] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCompDropdown, setShowCompDropdown] = useState(false);
  const [isExamActive, setIsExamActive] = useState(false);

  useEffect(() => {
    loadPortalsAndCompetitions();
  }, [user]);

  const loadPortalsAndCompetitions = async () => {
    setLoading(true);
    try {
      const res = await getMyPortals();
      if (res.success && res.data) {
        setPortals(res.data);
        const comps = res.data.competitions || [];
        if (comps.length > 0) {
          setCurrentCompetition(comps[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load portal access:', err);
    } finally {
      setLoading(false);
    }
  };

  const isTrainerOrAdmin = ['TRAINER', 'ADMIN', 'SUPER_ADMIN'].includes((user?.role || '').toUpperCase());
  const canSwitchToLearning = Boolean(
    (portals.learning ?? user?.hasCourseEnrollment) &&
    (portals.competition ?? user?.hasCompetitionRegistration) &&
    (user?.role || '').toUpperCase() === 'STUDENT'
  );

  const navItems = [
    { label: 'Overview', path: '/competition', icon: Trophy },
    { label: 'Syllabus & Guidance Videos', path: '/competition/syllabus', icon: BookOpen },
    { label: 'Study Materials', path: '/competition/materials', icon: FileText },
    { label: 'Test Series', path: '/competition/test-series', icon: Layers, badge: '35 slots' },
    { label: 'Mock Tests', path: '/competition/mock-tests', icon: Target, badge: '4 slots' },
    { label: 'Final Assessment', path: '/competition/final-assessment', icon: Award, badge: 'Main Exam' },
    { label: 'Leaderboard', path: '/competition/leaderboard', icon: BarChart2 }
  ];

  if (isTrainerOrAdmin) {
    navItems.push({
      label: 'Trainer Evaluations',
      path: '/competition/evaluations',
      icon: CheckSquare,
      badge: 'Voice Desk'
    });
  }

  const handleSwitchToLearning = () => {
    const roleUpper = (user?.role || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
      navigate('/admin');
    } else if (roleUpper === 'TRAINER') {
      navigate('/trainer');
    } else {
      navigate('/student');
    }
  };

  if (loading) {
    return <PageLoader text="Loading Competition Portal..." />;
  }

  // If user has no competition access at all
  if (!portals.competition && (!portals.competitions || portals.competitions.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-2xl font-black">No Active Competition Registrations</h2>
        <p className="text-slate-400 text-xs max-w-md">
          You are not currently registered for any live competitions. Browse our open scholastic competitions to enroll.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => navigate('/competitions')}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer"
          >
            Browse Competitions
          </button>
          {portals.learning && (
            <button
              onClick={handleSwitchToLearning}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Go to Learning Portal
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-full flex overflow-hidden ${isExamActive ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans antialiased`}>
      {/* Sidebar - Desktop */}
      {!isExamActive && (
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0">
        <div className="p-5 flex items-center space-x-3 border-b border-slate-800">
          <img src="/assets/logo.png" alt="Zoro Logo" className="h-7 w-auto object-contain" />
          <div>
            <span className="font-extrabold text-white text-xs block leading-tight">Zoro English Academy</span>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Competition Portal</span>
          </div>
        </div>

        {/* Competition Dropdown in Sidebar */}
        {portals.competitions && portals.competitions.length > 0 && (
          <div className="p-3 border-b border-slate-800/80">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 px-2">
              Active Competition
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCompDropdown(!showCompDropdown)}
                className="w-full flex items-center justify-between p-2.5 bg-slate-800/90 hover:bg-slate-800 rounded-xl text-xs font-bold text-white transition cursor-pointer border border-slate-700/60"
              >
                <div className="flex items-center space-x-2 truncate">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{currentCompetition?.title || currentCompetition?.name || 'Select Competition'}</span>
                </div>
                {portals.competitions.length > 1 && <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
              </button>

              {showCompDropdown && portals.competitions.length > 1 && (
                <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                  {portals.competitions.map((comp) => (
                    <div
                      key={comp.id}
                      onClick={() => {
                        setCurrentCompetition(comp);
                        setShowCompDropdown(false);
                      }}
                      className={`px-3 py-2 text-xs font-semibold cursor-pointer transition flex items-center justify-between ${
                        currentCompetition?.id === comp.id
                          ? 'bg-amber-500/20 text-amber-300 font-bold'
                          : 'text-slate-300 hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="truncate">{comp.title || comp.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer: Switch to Learning Portal & Sign Out */}
        <div className="p-3 border-t border-slate-800 space-y-1.5">
          {canSwitchToLearning && (
            <button
              onClick={handleSwitchToLearning}
              className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition cursor-pointer border border-slate-700/60"
            >
              <GraduationCap className="w-4 h-4 text-blue-400" />
              <span>Switch to Learning Portal</span>
            </button>
          )}

          <button
            onClick={logout}
            className="w-full flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-800/40 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      )}

      {/* Mobile Drawer */}
      {!isExamActive && isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] bg-slate-900 text-white flex flex-col h-full shadow-2xl z-10">
            <div className="p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <img src="/assets/logo.png" alt="Zoro Logo" className="h-6 w-auto" />
                <span className="font-black text-xs">Competition Portal</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded">{item.badge}</span>}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-800 space-y-2">
              {canSwitchToLearning && (
                <button
                  onClick={handleSwitchToLearning}
                  className="w-full flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-blue-400"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Switch to Learning Portal</span>
                </button>
              )}
              <button
                onClick={logout}
                className="w-full flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs text-rose-400 font-bold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header */}
        {!isExamActive && (
          <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-slate-900 tracking-tight">Competition Portal</span>
                {currentCompetition && (
                  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                    {currentCompetition.title || currentCompetition.name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Switch Portal Button (Shown when both portals are accessible) */}
              {portals.learning && (
                <button
                  onClick={handleSwitchToLearning}
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0F52BA] border border-blue-200 text-xs font-bold transition cursor-pointer shadow-2xs"
                  title="Switch back to Learning Portal without logging out"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Switch to Learning Portal</span>
                </button>
              )}

              {/* Profile Avatar */}
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                {user?.avatar ? (
                  <img
                    src={resolveFileUrl(user.avatar)}
                    alt={user.name || 'User'}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs ring-2 ring-blue-500/20">
                    {user?.name ? user.name.trim().charAt(0).toUpperCase() : <User className="w-4 h-4 text-blue-600" />}
                  </div>
                )}
                <div className="hidden lg:block text-left leading-tight">
                  <span className="text-xs font-bold text-slate-800 block">{user?.name}</span>
                  <span className="text-[10px] font-semibold text-slate-500 block">Candidate</span>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Content Area */}
        <main className={`flex-1 ${isExamActive ? 'p-0 overflow-y-auto bg-slate-950 text-slate-100' : 'p-4 sm:p-6 lg:p-8 overflow-y-auto'}`}>
          <div key={location.pathname} className={isExamActive ? '' : 'page-transition'}>
            <Outlet context={{ currentCompetition, setCurrentCompetition, portals, isExamActive, setIsExamActive }} />
          </div>
        </main>
      </div>
    </div>
  );
}
