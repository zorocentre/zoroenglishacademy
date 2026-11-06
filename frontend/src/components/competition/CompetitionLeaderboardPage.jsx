import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  Trophy, Award, Medal, Crown, Search, RefreshCw, 
  Eye, EyeOff, CheckCircle2, Clock, Sparkles, Filter, 
  User, ChevronRight, BarChart2, BookOpen, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getCompetitionLeaderboard, 
  recalculateCompetitionLeaderboard, 
  publishCompetitionLeaderboard, 
  unpublishCompetitionLeaderboard, 
  toggleCompetitionAnswerReview 
} from '../../api/competitionApi';
import { formatDate } from '../../utils/dateFormatter';
import SkeletonCard from '../common/SkeletonCard';

const SET_STYLES = {
  A: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  B: { badge: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  C: { badge: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' },
  D: { badge: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' }
};

export default function CompetitionLeaderboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentCompetition } = useOutletContext();

  const [loading, setLoading] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'A' | 'B' | 'C' | 'D'
  const [searchTerm, setSearchTerm] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const roleUpper = (user?.role || '').toUpperCase();
  const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN';
  const isStaff = isAdmin || roleUpper === 'TRAINER';

  useEffect(() => {
    if (!currentCompetition?.id) return;
    loadLeaderboard();
  }, [currentCompetition]);

  const loadLeaderboard = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await getCompetitionLeaderboard(currentCompetition.id);
      if (res && res.success && res.data) {
        setLeaderboardData(res.data);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Live polling every 12s and refetch on tab focus
  useEffect(() => {
    if (!currentCompetition?.id) return;

    const pollInterval = setInterval(() => {
      loadLeaderboard(false);
    }, 12000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadLeaderboard(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentCompetition?.id]);

  // Countdown timer calculation if unpublished
  useEffect(() => {
    if (!leaderboardData || leaderboardData.isPublished || !leaderboardData.publishedAt) return;

    const targetDate = new Date(leaderboardData.publishedAt).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = Math.max(0, targetDate - now);

      if (diff <= 0) {
        clearInterval(interval);
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        loadLeaderboard(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [leaderboardData]);

  // Admin Actions
  const handleRecalculate = async () => {
    setAdminActionLoading(true);
    try {
      const res = await recalculateCompetitionLeaderboard(currentCompetition.id);
      if (res && res.success && res.data) {
        setLeaderboardData(res.data);
      }
    } catch (err) {
      console.error('Failed to recalculate:', err);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleTogglePublish = async () => {
    setAdminActionLoading(true);
    try {
      let res;
      if (leaderboardData?.isPublished) {
        res = await unpublishCompetitionLeaderboard(currentCompetition.id);
      } else {
        res = await publishCompetitionLeaderboard(currentCompetition.id);
      }
      if (res && res.success && res.data) {
        setLeaderboardData(res.data);
      }
    } catch (err) {
      console.error('Failed to toggle publish:', err);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleToggleAnswerReview = async () => {
    setAdminActionLoading(true);
    try {
      const res = await toggleCompetitionAnswerReview(currentCompetition.id);
      if (res && res.success) {
        setLeaderboardData(prev => ({
          ...prev,
          answerReviewEnabled: res.data.answerReviewEnabled
        }));
      }
    } catch (err) {
      console.error('Failed to toggle answer review:', err);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const allEntries = leaderboardData?.entries || [];
  const filteredEntries = allEntries.filter(entry => {
    if (activeTab !== 'ALL' && (entry.setCode || 'A').toUpperCase() !== activeTab) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = (entry.studentName || '').toLowerCase().includes(term);
      const matchReg = (entry.registrationId || '').toLowerCase().includes(term);
      if (!matchName && !matchReg) return false;
    }
    return true;
  });

  const podium = leaderboardData?.podium || [];
  const myRank = leaderboardData?.myRank;
  const isPublished = Boolean(leaderboardData?.isPublished);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans antialiased text-slate-900">
      
      {/* Top Banner / Hero Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-700 text-xs font-bold">
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Championship Leaderboard</span>
            </span>

            {isPublished ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Official Standings Live</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Evaluation in Progress / Scheduled</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {currentCompetition?.title || 'Competition'} Merit List
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl font-medium">
            Authoritative rankings computed across objective examination sections and speech recordings.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isAdmin && (
            <>
              <button
                disabled={adminActionLoading}
                onClick={handleRecalculate}
                className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer border border-slate-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adminActionLoading ? 'animate-spin' : ''}`} />
                <span>Recalculate</span>
              </button>

              <button
                disabled={adminActionLoading}
                onClick={handleTogglePublish}
                className={`inline-flex items-center space-x-2 px-4 py-2 font-black rounded-xl text-xs transition cursor-pointer shadow-xs disabled:opacity-50 ${
                  isPublished 
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isPublished ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Unpublish</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Publish Results</span>
                  </>
                )}
              </button>

              <button
                disabled={adminActionLoading}
                onClick={handleToggleAnswerReview}
                className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  leaderboardData?.answerReviewEnabled
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Review: {leaderboardData?.answerReviewEnabled ? 'Enabled' : 'Disabled'}</span>
              </button>
            </>
          )}

          <button
            onClick={loadLeaderboard}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer border border-slate-200"
            title="Refresh Leaderboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* UNPUBLISHED COUNTDOWN STATE FOR STUDENTS */}
      {!isPublished && !isAdmin && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-800 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black">
              Official Leaderboard Pending Release
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed">
              Our evaluation committee is completing speech evaluations and cross-checking set rankings. The merit list will unlock automatically.
            </p>
          </div>

          {leaderboardData?.publishedAt && (
            <div className="inline-block p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                Scheduled Release Time: {formatDate(leaderboardData.publishedAt)}
              </div>
              <div className="grid grid-cols-4 gap-3 sm:gap-6 text-center">
                <div className="bg-slate-800/80 px-3 py-2 rounded-xl">
                  <span className="text-xl sm:text-2xl font-black text-white">{countdown.days}</span>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Days</span>
                </div>
                <div className="bg-slate-800/80 px-3 py-2 rounded-xl">
                  <span className="text-xl sm:text-2xl font-black text-white">{countdown.hours}</span>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Hours</span>
                </div>
                <div className="bg-slate-800/80 px-3 py-2 rounded-xl">
                  <span className="text-xl sm:text-2xl font-black text-white">{countdown.minutes}</span>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Mins</span>
                </div>
                <div className="bg-slate-800/80 px-3 py-2 rounded-xl">
                  <span className="text-xl sm:text-2xl font-black text-white">{countdown.seconds}</span>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Secs</span>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-400">
            Total Enrolled Candidates in this Competition: <strong className="text-white">{leaderboardData?.totalParticipants || 0}</strong>
          </div>
        </div>
      )}

      {/* STUDENT'S PERSONAL STANDING SPOTLIGHT CARD */}
      {(isPublished || isAdmin) && myRank && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 rounded-3xl p-6 sm:p-7 text-slate-950 shadow-md border border-amber-300 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
            <Trophy className="w-64 h-64 text-slate-950" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-950 text-white">
                  Your Official Performance Card
                </span>
                {isStaff && myRank.setCode && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white/80 text-slate-900 border border-slate-950/20">
                    Set {myRank.setCode}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                {myRank.studentName}
              </h2>
            </div>

            {/* Score & Rank Metrics */}
            <div className={`grid ${isStaff && myRank.setCode ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-3`}>
              <div className="bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-amber-600/20 text-center space-y-0.5">
                <span className="text-[10px] font-bold text-slate-600 uppercase">Overall Rank</span>
                <div className="text-2xl font-black text-slate-950">#{myRank.rank}</div>
                <div className="text-[10px] text-slate-500">of {leaderboardData.totalParticipants}</div>
              </div>

              {isStaff && myRank.setCode && (
                <div className="bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-amber-600/20 text-center space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Set {myRank.setCode} Rank</span>
                  <div className="text-2xl font-black text-blue-700">#{myRank.setRank || myRank.rank}</div>
                  <div className="text-[10px] text-blue-600">in Set {myRank.setCode}</div>
                </div>
              )}

              <div className="bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-amber-600/20 text-center space-y-0.5">
                <span className="text-[10px] font-bold text-slate-600 uppercase">Total Marks</span>
                <div className="text-2xl font-black text-emerald-700">
                  {Number(myRank.totalMarks || 0).toFixed(1)}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold">Verified Score</div>
              </div>

              <div className="bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-amber-600/20 text-center space-y-0.5">
                <span className="text-[10px] font-bold text-slate-600 uppercase">Percentile</span>
                <div className="text-2xl font-black text-indigo-700">
                  {Number(myRank.percentile || 0).toFixed(1)}%
                </div>
                <div className="text-[10px] text-indigo-600 font-semibold">All Olympians</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOP 3 PODIUM DISPLAY */}
      {(isPublished || isAdmin) && podium.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Championship Honors</span>
              </span>
              <h3 className="text-lg font-black text-slate-900">Podium Finishes</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Top 3 All-India Ranked Olympians</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {podium.map((p, idx) => {
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isThird = idx === 2;

              const medalBg = isFirst 
                ? 'bg-gradient-to-b from-amber-500/10 to-amber-500/20 border-amber-400/60'
                : isSecond
                  ? 'bg-gradient-to-b from-slate-100 to-slate-200/60 border-slate-300'
                  : 'bg-gradient-to-b from-amber-800/10 to-amber-800/20 border-amber-700/40';

              const badgeColor = isFirst 
                ? 'bg-amber-500 text-slate-950'
                : isSecond
                  ? 'bg-slate-700 text-white'
                  : 'bg-amber-800 text-white';

              return (
                <div 
                  key={p.id || idx} 
                  className={`rounded-2xl border p-5 space-y-3 text-center flex flex-col justify-between ${medalBg} ${
                    isFirst ? 'ring-2 ring-amber-400 shadow-md md:-translate-y-2' : ''
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${badgeColor}`}>
                        #{idx + 1}
                      </span>
                      {isStaff && p.setCode && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black border ${
                          SET_STYLES[p.setCode]?.badge || SET_STYLES.A.badge
                        }`}>
                          Set {p.setCode}
                        </span>
                      )}
                    </div>

                    <div className="pt-1">
                      {isFirst ? (
                        <Crown className="w-8 h-8 text-amber-500 mx-auto animate-bounce" />
                      ) : (
                        <Medal className="w-7 h-7 text-slate-500 mx-auto" />
                      )}
                    </div>

                    <h4 className="text-base font-black text-slate-900 truncate flex items-center justify-center gap-1.5">
                      <span>{p.studentName}</span>
                      {p.isProvisional && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                          Provisional
                        </span>
                      )}
                    </h4>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-black">
                    <span className="text-slate-500 text-[11px] font-medium">Marks:</span>
                    <span className="text-base font-black text-slate-900">
                      {Number(p.totalMarks || 0).toFixed(1)}
                    </span>
                    <span className="text-xs text-blue-600 font-bold">
                      {Number(p.percentile || 0).toFixed(1)}%ile
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER TABS & SEARCH BAR */}
      {(isPublished || isAdmin) && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Overall ({allEntries.length})
            </button>
            {isStaff && ['A', 'B', 'C', 'D'].map(code => (
              <button
                key={code}
                onClick={() => setActiveTab(code)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === code
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Set {code}</span>
                {leaderboardData?.setStats?.[code]?.count !== undefined && (
                  <span className="text-[10px] opacity-75">
                    ({leaderboardData.setStats[code].count})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* FULL LEADERBOARD TABLE */}
      {(isPublished || isAdmin) && (
        loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No candidates found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No registered candidates match the current search or set filter criteria.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4 text-center w-16">Rank</th>
                    <th className="py-3.5 px-4">Student</th>
                    {isStaff && <th className="py-3.5 px-4">Set Assigned</th>}
                    {isStaff && <th className="py-3.5 px-4">Set Standing</th>}
                    <th className="py-3.5 px-4 text-right">Total Score</th>
                    <th className="py-3.5 px-4 text-right">Percentile</th>
                    <th className="py-3.5 px-4 text-right">Merit Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredEntries.map((row) => {
                    const isPodium = row.rank <= 3;
                    const isUserRow = myRank && myRank.registrationId === row.registrationId;
                    const setStyle = SET_STYLES[row.setCode] || SET_STYLES.A;

                    return (
                      <tr 
                        key={row.id || row.registrationId} 
                        className={`transition ${
                          isUserRow 
                            ? 'bg-amber-50/70 font-semibold' 
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        {/* Rank Column */}
                        <td className="py-3.5 px-4 text-center">
                          {row.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-xs">
                              🥇
                            </span>
                          ) : row.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-black text-xs shadow-xs">
                              🥈
                            </span>
                          ) : row.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-black text-xs shadow-xs">
                              🥉
                            </span>
                          ) : (
                            <span className="font-bold text-slate-600 text-xs font-mono">
                              #{row.rank}
                            </span>
                          )}
                        </td>

                        {/* Student Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{row.studentName}</span>
                            {row.isProvisional && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                Provisional
                              </span>
                            )}
                            {isUserRow && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-slate-950">
                                You
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Set Code */}
                        {isStaff && (
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border ${setStyle.badge}`}>
                              Set {row.setCode || 'A'}
                            </span>
                          </td>
                        )}

                        {/* Set Rank */}
                        {isStaff && (
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-700 text-[11px]">
                              #{row.setRank || row.rank} <span className="text-slate-400 text-[10px] font-normal">in Set {row.setCode}</span>
                            </span>
                          </td>
                        )}

                        {/* Total Score */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-black text-slate-900 text-sm">
                            {Number(row.totalMarks || 0).toFixed(1)}
                          </span>
                          <span className="text-slate-400 text-xs font-normal"> marks</span>
                        </td>

                        {/* Percentile */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                            {Number(row.percentile || 0).toFixed(1)}%ile
                          </span>
                        </td>

                        {/* Merit Standing */}
                        <td className="py-3.5 px-4 text-right">
                          {row.rank <= 3 ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>Gold Honors</span>
                            </span>
                          ) : Number(row.percentile || 0) >= 80 ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Distinction</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              Merit Qualified
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

    </div>
  );
}
