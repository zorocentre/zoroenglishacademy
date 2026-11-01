import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Trophy, ArrowRight, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMyPortals } from '../../api/competitionApi';
import PageLoader from '../common/PageLoader';
import Logo from '../common/Logo';

export default function PortalSelectPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [portals, setPortals] = useState({ learning: false, competition: false, competitions: [] });

  useEffect(() => {
    const roleUpper = (user?.role || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
      navigate('/admin', { replace: true });
      return;
    }
    if (roleUpper === 'TRAINER') {
      navigate('/trainer', { replace: true });
      return;
    }

    async function fetchPortals() {
      try {
        const res = await getMyPortals();
        if (res.success && res.data) {
          const learning = Boolean(res.data.learning ?? user?.hasCourseEnrollment);
          const competition = Boolean(res.data.competition ?? user?.hasCompetitionRegistration);
          setPortals({ ...res.data, learning, competition });

          // If student has only one portal, redirect immediately
          if (learning && !competition) {
            navigate('/student', { replace: true });
            return;
          }
          if (!learning && competition) {
            navigate('/competition', { replace: true });
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load portals:', err);
        if (user?.hasCourseEnrollment && !user?.hasCompetitionRegistration) {
          navigate('/student', { replace: true });
          return;
        } else if (!user?.hasCourseEnrollment && user?.hasCompetitionRegistration) {
          navigate('/competition', { replace: true });
          return;
        }
      } finally {
        setLoading(false);
      }
    }
    fetchPortals();
  }, [user]);

  const goToLearning = () => {
    const role = (user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      navigate('/admin');
    } else if (role === 'TRAINER') {
      navigate('/trainer');
    } else {
      navigate('/student');
    }
  };

  const goToCompetition = () => {
    navigate('/competition');
  };

  if (loading) {
    return <PageLoader text="Loading your portals..." />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center space-x-3">
          <Logo size="w-8 h-8" alt="Zoro Logo" />
          <span className="font-black text-sm tracking-tight text-white">Zoro English Academy</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-2 text-xs font-bold text-slate-400 hover:text-white px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Selection Area */}
      <main className="max-w-4xl w-full mx-auto my-auto py-12 text-center space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Unified Zoro Account</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Welcome, {user?.name || 'Student'}!
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Your account has access to multiple portals. Select the portal you wish to enter:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto text-left">
          {/* Learning Portal Card */}
          <div
            onClick={goToLearning}
            className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-3xl p-6 sm:p-8 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-6 shadow-xl hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">
                  Learning Portal
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Access your enrolled courses, syllabus, interactive classroom modules, live class schedules, assignments, and doubts.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:text-blue-300">
              <span>Enter Learning Portal</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Competition Portal Card */}
          <div
            onClick={goToCompetition}
            className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-6 sm:p-8 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-6 shadow-xl hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <Trophy className="w-7 h-7" />
                </div>
                {portals.competitions && portals.competitions.length > 0 && (
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-black">
                    {portals.competitions.length} Registered
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">
                  Competition Portal
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Access your registered competitions, syllabus PDF, guidance videos, study materials, test series, and live leaderboards.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300">
              <span>Enter Competition Portal</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center py-4 text-slate-500 text-xs">
        © 2026 Zoro English Academy. You can switch between portals at any time from the portal header.
      </footer>
    </div>
  );
}
