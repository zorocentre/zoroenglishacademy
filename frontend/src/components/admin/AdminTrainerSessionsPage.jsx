import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Video, Calendar, Clock, Eye, Search, 
  Users, CheckCircle2, AlertCircle, RefreshCw, Lock, BookOpen
} from 'lucide-react';
import { getAdminTrainerSessions, startSchedule } from '../../api/scheduleApi';
import { 
  sortSchedulesChronologically, 
  syncServerTime, 
  getNowInKolkata,
  getSessionStartDateTime,
  getSessionEndDateTime,
  isValidGoogleMeetUrl
} from '../../utils/scheduleSortUtil';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import PageLoader from '../common/PageLoader';

export default function AdminTrainerSessionsPage({ setActiveScreen: _setActiveScreen }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentTime, setCurrentTime] = useState(getNowInKolkata());
  const [viewerFile, setViewerFile] = useState(null);
  const [startingId, setStartingId] = useState(null);
  const [actionError, setActionError] = useState('');

  // 1. Fetch Schedules from backend
  const loadSessions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      await syncServerTime();
      const res = await getAdminTrainerSessions();
      if (res && res.success && Array.isArray(res.data)) {
        setSchedules(res.data);
      } else if (Array.isArray(res)) {
        setSchedules(res);
      }
    } catch (err) {
      console.error('Failed to load trainer sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 2. Real-time Clock & Auto-refresh (3-second tick for instantaneous state flip)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getNowInKolkata());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // 3. Periodic background polling every 20 seconds
  useEffect(() => {
    const pollTimer = setInterval(() => {
      loadSessions(true);
    }, 20000);
    return () => clearInterval(pollTimer);
  }, [loadSessions]);

  // Extract unique courses for filter dropdown
  const uniqueCourses = useMemo(() => {
    const map = new Map();
    schedules.forEach(s => {
      const title = s.course || 'Unknown Course';
      if (!map.has(title)) {
        map.set(title, { id: s.courseId || title, title });
      }
    });
    return Array.from(map.values());
  }, [schedules]);

  // Helper to extract resource
  const getAttachedResource = (item, type) => {
    if (!item) return null;
    if (type === 'notes') {
      const url = item.notesFileUrl || item.notesUrl;
      const name = item.notesFileName || `Notes - ${item.title}`;
      return url ? { name, url, type: 'notes' } : null;
    }
    if (type === 'worksheet') {
      const url = item.worksheetFileUrl || item.worksheetUrl;
      const name = item.worksheetFileName || `Worksheet - ${item.title}`;
      return url ? { name, url, type: 'worksheet' } : null;
    }
    if (type === 'assignment') {
      const url = item.assignmentFileUrl || item.assignmentUrl;
      const name = item.assignmentFileName || `Assignment - ${item.title}`;
      return url ? { name, url, type: 'assignment' } : null;
    }
    return null;
  };

  // Evaluate real-time session state against server Asia/Kolkata time
  const processedSchedules = useMemo(() => {
    const sorted = sortSchedulesChronologically(schedules);
    const nowMs = currentTime.getTime();

    return sorted.map(sch => {
      const start = getSessionStartDateTime(sch.date, sch.time || sch.startTime);
      const end = getSessionEndDateTime(sch.date, sch.time || sch.endTime);
      const startMs = start ? start.getTime() : 0;
      const endMs = end ? end.getTime() : (startMs + 60 * 60 * 1000);

      let status = 'Upcoming';
      let buttonState = 'BEFORE_START'; // 'BEFORE_START' | 'LIVE_ENABLED' | 'SESSION_ENDED'

      if (nowMs >= endMs) {
        status = 'Completed';
        buttonState = 'SESSION_ENDED';
      } else if (nowMs >= startMs && nowMs < endMs) {
        status = 'Live now';
        buttonState = 'LIVE_ENABLED';
      } else {
        status = 'Upcoming';
        buttonState = 'BEFORE_START';
      }

      // Documents unlock 30 minutes before session start
      const unlockThresholdMs = startMs - 30 * 60 * 1000;
      let isDocLocked = false;
      let unlockLabel = '';

      if (status === 'Upcoming' && nowMs < unlockThresholdMs) {
        isDocLocked = true;
        if (sch.unlockTimeLabel) {
          unlockLabel = sch.unlockTimeLabel;
        } else if (start) {
          const unlockDate = new Date(unlockThresholdMs);
          let h = unlockDate.getUTCHours();
          const m = unlockDate.getUTCMinutes();
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          const pad = n => String(n).padStart(2, '0');
          unlockLabel = `Unlocks at ${pad(h)}:${pad(m)} ${ampm}`;
        } else {
          unlockLabel = 'Unlocks 30m before class';
        }
      }

      // Backend lock override if provided
      if (sch.locked === true) {
        isDocLocked = true;
        if (sch.unlockTimeLabel) unlockLabel = sch.unlockTimeLabel;
      }

      return {
        ...sch,
        computedStatus: status,
        buttonState,
        isDocLocked,
        unlockLabel
      };
    });
  }, [schedules, currentTime]);

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return processedSchedules.filter(sch => {
      // 1. Course filter
      if (selectedCourse !== 'ALL' && (sch.course || '') !== selectedCourse) {
        return false;
      }
      // 2. Date filter
      if (selectedDate && sch.date !== selectedDate) {
        return false;
      }
      // 3. Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'Upcoming' && sch.computedStatus !== 'Upcoming') return false;
        if (selectedStatus === 'Live' && sch.computedStatus !== 'Live now') return false;
        if (selectedStatus === 'Completed' && sch.computedStatus !== 'Completed') return false;
      }
      // 4. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = (sch.title || '').toLowerCase().includes(q);
        const matchCourse = (sch.course || '').toLowerCase().includes(q);
        const matchBatch = (sch.batch || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCourse && !matchBatch) return false;
      }
      return true;
    });
  }, [processedSchedules, selectedCourse, selectedDate, selectedStatus, searchTerm]);

  // Metrics summary
  const metrics = useMemo(() => {
    let total = processedSchedules.length;
    let live = 0;
    let upcoming = 0;
    let completed = 0;
    let totalEnrolledTrainers = 0;

    processedSchedules.forEach(s => {
      if (s.computedStatus === 'Live now') live++;
      else if (s.computedStatus === 'Upcoming') upcoming++;
      else if (s.computedStatus === 'Completed') completed++;
      totalEnrolledTrainers = Math.max(totalEnrolledTrainers, s.studentsCount || 0);
    });

    return { total, live, upcoming, completed, totalEnrolledTrainers };
  }, [processedSchedules]);

  // Handle Start Session click
  const handleStartSession = async (schedule) => {
    setActionError('');
    setStartingId(schedule.id);
    try {
      const res = await startSchedule(schedule.id);
      const url = res?.data?.meetUrl || res?.meetUrl || schedule.meetLink || schedule.googleMeetUrl;
      if (url && isValidGoogleMeetUrl(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setActionError('Meeting link is not configured for this session. Please set a Google Meet URL.');
      }
    } catch (err) {
      console.error('Failed to start session:', err);
      const msg = err?.response?.data?.message || err?.message || 'Access Denied: Session cannot be started outside the scheduled window.';
      setActionError(msg);
    } finally {
      setStartingId(null);
    }
  };

  if (loading) {
    return <PageLoader fullPage message="Loading trainer sessions..." />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trainers Session</h1>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
              Admin Conducted
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Admin live sessions for trainer-audience courses. Start session and manage live classes.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadSessions(false)}
            disabled={refreshing || loading}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-rose-500 hover:text-rose-700 font-bold ml-2">✕</button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Schedules</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[10px] font-medium text-slate-400 mt-0.5">Online & Hybrid live classes</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Live Now</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{metrics.live}</div>
          <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">Active session in progress</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Upcoming</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{metrics.upcoming}</div>
          <div className="text-[10px] font-medium text-blue-500 mt-0.5">Scheduled for start</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{metrics.completed}</div>
          <div className="text-[10px] font-medium text-slate-400 mt-0.5">Past concluded sessions</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* 1. Course Filter */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
              Course (Online / Hybrid)
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Trainer Courses</option>
              {uniqueCourses.map(c => (
                <option key={c.id} value={c.title}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* 2. Date Filter */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
              Filter by Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 3. Status Filter */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
              Session Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Live">Live Now</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* 4. Search Filter */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
              Search by Title
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search session title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {(selectedCourse !== 'ALL' || selectedDate || selectedStatus !== 'ALL' || searchTerm) && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              Showing {filteredSchedules.length} of {processedSchedules.length} sessions
            </span>
            <button
              onClick={() => {
                setSelectedCourse('ALL');
                setSelectedDate('');
                setSelectedStatus('ALL');
                setSearchTerm('');
              }}
              className="text-blue-600 hover:text-blue-700 font-bold"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Schedules List (Time Slot Ascending) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Schedules (Time Slot Ascending)
          </h2>
          <span className="text-xs font-bold text-slate-500">
            {filteredSchedules.length} {filteredSchedules.length === 1 ? 'Session' : 'Sessions'}
          </span>
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200">
            <PageLoader message="Loading trainer sessions..." />
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-3">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-black text-slate-800">No Trainer Sessions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
              {processedSchedules.length === 0
                ? "No schedules have been scheduled yet for trainer-audience live courses (Online / Hybrid)."
                : "No sessions matched your selected filter criteria. Try clearing filters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredSchedules.map((item) => {
              const notes = getAttachedResource(item, 'notes');
              const ws = getAttachedResource(item, 'worksheet');
              const asg = getAttachedResource(item, 'assignment');
              const hasResources = Boolean(notes || ws || asg);

              return (
                <div 
                  key={item.id} 
                  className={`p-5 bg-white rounded-3xl border transition-all shadow-xs ${
                    item.computedStatus === 'Live now' 
                      ? 'border-emerald-300 ring-2 ring-emerald-100 bg-emerald-50/20' 
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    {/* Left: Schedule Information */}
                    <div className="space-y-3 flex-1 min-w-0">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status Badge */}
                        {item.computedStatus === 'Live now' && (
                          <span className="inline-flex items-center space-x-1.5 bg-emerald-500 text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider animate-pulse shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-white"></span>
                            <span>Live now</span>
                          </span>
                        )}
                        {item.computedStatus === 'Upcoming' && (
                          <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>Upcoming</span>
                          </span>
                        )}
                        {item.computedStatus === 'Completed' && (
                          <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3 text-slate-500" />
                            <span>Completed</span>
                          </span>
                        )}

                        {/* Mode & Batch */}
                        <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                          {item.batch || 'Trainer Batch'}
                        </span>

                        {/* Enrolled Trainers Count */}
                        <span className="inline-flex items-center space-x-1 text-[11px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                          <Users className="w-3 h-3 text-purple-600" />
                          <span>{item.studentsCount || 0} Trainers Enrolled</span>
                        </span>
                      </div>

                      {/* Title and Course */}
                      <div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs font-bold text-slate-600 flex items-center space-x-1.5 mt-0.5">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.course}</span>
                        </p>
                      </div>

                      {/* Date & Time Slot */}
                      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 w-fit">
                        <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>{item.date || 'TBD'}</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <div className="flex items-center space-x-1.5 font-mono text-slate-800 font-bold">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{item.time || item.startTime || 'TBD'}</span>
                        </div>
                      </div>

                      {/* Attachments (View-Only, unlocked 30 mins before start) */}
                      <div className="pt-1">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                          <span>Session Attachments</span>
                          <span className="text-slate-400 font-normal">(View-Only)</span>
                        </div>

                        {!hasResources ? (
                          <div className="text-[11px] font-medium text-slate-400 italic">
                            No attachments uploaded for this session.
                          </div>
                        ) : item.isDocLocked ? (
                          <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs font-semibold w-fit">
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Documents locked • {item.unlockLabel || 'Unlocks 30 minutes before class'}</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {notes && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(notes)}
                                className="inline-flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                                title="View Notes (Download Disabled)"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                <span>Notes</span>
                              </button>
                            )}

                            {ws && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(ws)}
                                className="inline-flex items-center space-x-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                                title="View Worksheet (Download Disabled)"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Worksheet</span>
                              </button>
                            )}

                            {asg && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(asg)}
                                className="inline-flex items-center space-x-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                                title="View Assignment (Download Disabled)"
                              >
                                <Eye className="w-3.5 h-3.5 text-purple-600" />
                                <span>Assignment</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Start Session Action Button */}
                    <div className="flex flex-col sm:items-end justify-center shrink-0 lg:border-l lg:border-slate-100 lg:pl-6 pt-3 lg:pt-0">
                      {item.buttonState === 'BEFORE_START' && (
                        <div className="space-y-1.5 text-center sm:text-right">
                          <button
                            type="button"
                            disabled
                            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-100 text-slate-400 font-extrabold px-6 py-3 rounded-2xl text-xs border border-slate-200 cursor-not-allowed opacity-90"
                            title="Session has not started yet. Opens at scheduled start time."
                          >
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>Starts at {item.time ? item.time.split('-')[0].trim() : 'Scheduled Time'}</span>
                          </button>
                          <p className="text-[10px] font-semibold text-slate-400">
                            Start button enables automatically at session start
                          </p>
                        </div>
                      )}

                      {item.buttonState === 'LIVE_ENABLED' && (
                        <div className="space-y-1.5 text-center sm:text-right">
                          <button
                            type="button"
                            onClick={() => handleStartSession(item)}
                            disabled={startingId === item.id}
                            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black px-7 py-3 rounded-2xl text-xs shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                          >
                            <Video className="w-4 h-4" />
                            <span>{startingId === item.id ? 'Connecting...' : 'Start Session'}</span>
                          </button>
                          <p className="text-[10px] font-bold text-emerald-600 flex items-center justify-center sm:justify-end space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Session is currently live</span>
                          </p>
                        </div>
                      )}

                      {item.buttonState === 'SESSION_ENDED' && (
                        <div className="space-y-1 text-center sm:text-right">
                          <button
                            type="button"
                            disabled
                            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-100 text-slate-400 font-extrabold px-6 py-3 rounded-2xl text-xs border border-slate-200 cursor-not-allowed"
                          >
                            <CheckCircle2 className="w-4 h-4 text-slate-400" />
                            <span>Session Ended</span>
                          </button>
                          <p className="text-[10px] font-semibold text-slate-400">
                            Class concluded
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View-Only Universal File Viewer Modal */}
      {viewerFile && (
        <UniversalFileViewerModal
          isOpen={Boolean(viewerFile)}
          onClose={() => setViewerFile(null)}
          file={viewerFile}
          hideDownload={true}
        />
      )}
    </div>
  );
}
