import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Video, Copy, Calendar, Clock, AlertTriangle, Eye, Lock, CheckCircle, ChevronRight, BookOpen, Users, Check, AlertCircle, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSchedules, startSchedule } from '../../api/scheduleApi';
import { getStudents } from '../../api/userApi';
import { getAttendanceRecords } from '../../api/attendanceApi';
import {
  sortSchedulesChronologically,
  isValidGoogleMeetUrl,
  getScheduleJoinState,
  syncServerTime,
  getNowInKolkata,
  getSessionStartDateTime,
  getSessionEndDateTime,
  parseTimeToMinutes
} from '../../utils/scheduleSortUtil';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import PageLoader from '../common/PageLoader';
import { usePolling } from '../../hooks/usePolling';

export default function TrainerSessionsPage() {
  const { user } = useAuth();
  const trainerName = user?.name || '';
  const trainerId = user?.id || '';
  const isInactive = (user?.status || '').toLowerCase() === 'inactive';

  // Three slide buttons: [ Current Session | Next Session | Completed Sessions ]
  const [activeSlide, setActiveSlide] = useState('current'); // 'current' | 'next' | 'completed'
  const [copiedId, setCopiedId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [viewerFile, setViewerFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setTimerTick] = useState(0);

  // Selected date for Completed Sessions (defaults to today in YYYY-MM-DD)
  const [completedDate, setCompletedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const loadData = useCallback(async () => {
    try {
      await syncServerTime();
      const [schRes, stdRes, attRes] = await Promise.all([
        getSchedules(),
        getStudents(),
        getAttendanceRecords()
      ]);
      if (schRes?.data) setSchedules(schRes.data);
      if (stdRes?.data) setStudents(stdRes.data);
      if (attRes?.data) setAttendanceRecords(attRes.data);
    } catch (err) {
      console.error('Failed to load trainer sessions data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, user]);

  // Polling every 10s to keep attendance fresh while sessions are live
  usePolling(() => {
    setTimerTick(prev => prev + 1);
    loadData();
  }, 10000);

  const nowInKolkata = getNowInKolkata();
  const nowMs = nowInKolkata.getTime();
  const todayStr = `${nowInKolkata.getUTCFullYear()}-${String(nowInKolkata.getUTCMonth() + 1).padStart(2, '0')}-${String(nowInKolkata.getUTCDate()).padStart(2, '0')}`;

  // Filter to student-audience sessions taught by this trainer
  const taughtSchedules = useMemo(() => {
    return schedules.filter(item => {
      const aud = (item.audience || 'STUDENT').toUpperCase();
      if (aud !== 'STUDENT') return false;

      const isInstructor = (item.trainerId && item.trainerId === trainerId) ||
                           (item.trainer && item.trainer.toLowerCase().trim() === trainerName.toLowerCase().trim());
      return isInstructor;
    });
  }, [schedules, trainerId, trainerName]);

  // Helper to determine timing state of a session: UPCOMING, LIVE, COMPLETED
  const getSessionTiming = useCallback((sch) => {
    const start = getSessionStartDateTime(sch.date, sch.time || sch.startTime);
    const end = getSessionEndDateTime(sch.date, sch.time || sch.endTime);
    const startMs = start ? start.getTime() : 0;
    const endMs = end ? end.getTime() : 0;

    if (nowMs < startMs) return 'UPCOMING';
    if (nowMs >= startMs && nowMs <= endMs) return 'LIVE';
    return 'COMPLETED';
  }, [nowMs]);

  // Match students belonging to a schedule's batch
  const getStudentsForBatch = useCallback((sch) => {
    if (!sch) return [];
    return students.filter(s => {
      if (Array.isArray(s.courseBatches) && s.courseBatches.length > 0) {
        return s.courseBatches.some(cb =>
          (sch.batchId && cb.batchId === sch.batchId) ||
          (sch.batch && (cb.batch || '').toLowerCase().trim() === sch.batch.toLowerCase().trim())
        );
      }
      return (sch.batch && (s.batch || '').toLowerCase().trim() === sch.batch.toLowerCase().trim()) ||
             (sch.batchId && s.batchId === sch.batchId);
    });
  }, [students]);

  // Match student attendance record for a schedule
  const getStudentAttendanceRecord = useCallback((scheduleId, student) => {
    return attendanceRecords.find(r =>
      r.scheduleId === scheduleId &&
      (r.studentId === student.id || (r.studentName && r.studentName.toLowerCase().trim() === (student.name || '').toLowerCase().trim()))
    );
  }, [attendanceRecords]);

  // Attached resources helper
  const getAttachedResource = (item, type) => {
    if (!item) return null;
    if (type === 'assignment') {
      if (item.assignmentPdf) return typeof item.assignmentPdf === 'object' ? item.assignmentPdf : { name: `${item.title} Assignment.pdf`, fileUrl: item.assignmentPdf, type: 'pdf' };
      if (item.assignmentFileUrl) return { name: item.assignmentFileName || `${item.title} Assignment.pdf`, fileUrl: item.assignmentFileUrl, type: 'pdf' };
      if (item.assignmentFile) return item.assignmentFile;
    }
    if (type === 'worksheet') {
      if (item.worksheetPdf) return typeof item.worksheetPdf === 'object' ? item.worksheetPdf : { name: `${item.title} Worksheet.pdf`, fileUrl: item.worksheetPdf, type: 'pdf' };
      if (item.worksheetFileUrl) return { name: item.worksheetFileName || `${item.title} Worksheet.pdf`, fileUrl: item.worksheetFileUrl, type: 'pdf' };
      if (item.worksheetFile) return item.worksheetFile;
    }
    if (type === 'notes') {
      if (item.notesPdf) return typeof item.notesPdf === 'object' ? item.notesPdf : { name: `${item.title} Notes.pdf`, fileUrl: item.notesPdf, type: 'pdf' };
      if (item.notesFileUrl) return { name: item.notesFileName || `${item.title} Notes.pdf`, fileUrl: item.notesFileUrl, type: 'pdf' };
      if (item.notesFile) return item.notesFile;
    }

    if (item.resources && item.resources[type]) {
      const res = item.resources[type];
      return typeof res === 'string' ? { name: `${type.toUpperCase()} - ${item.title}`, fileUrl: res, type: 'pdf' } : res;
    }
    if (item[type]) {
      const res = item[type];
      return typeof res === 'string' ? { name: `${type.toUpperCase()} - ${item.title}`, fileUrl: res, type: 'pdf' } : res;
    }
    return null;
  };

  const handleStartSession = async (sch) => {
    if (!sch) return;
    try {
      const res = await startSchedule(sch.id);
      const url = res?.data?.meetUrl || res?.meetUrl || sch.meetUrl || sch.googleMeetUrl || sch.meetLink;
      if (url) {
        window.open(url, '_blank');
      }
      await loadData();
    } catch {
      const url = sch.meetUrl || sch.googleMeetUrl || sch.meetLink;
      if (url) {
        window.open(url, '_blank');
      }
    }
  };

  const handleCopyLink = (sch) => {
    const rawMeetUrl = sch?.googleMeetUrl || sch?.meetingUrl || sch?.meetLink || sch?.meetUrl || '';
    if (!rawMeetUrl) return;
    navigator.clipboard.writeText(rawMeetUrl);
    setCopiedId(sch.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Current Session:
  // "the session that must be handled first: the live session if one is running, otherwise the earliest upcoming session of today."
  const currentSession = useMemo(() => {
    const todaySessions = taughtSchedules.filter(s => s.date === todayStr);

    // Look for live session first
    const live = todaySessions.find(s => getSessionTiming(s) === 'LIVE');
    if (live) return live;

    // Otherwise earliest upcoming session of today
    const upcomingToday = todaySessions
      .filter(s => getSessionTiming(s) === 'UPCOMING')
      .sort((a, b) => parseTimeToMinutes(a.time || a.startTime) - parseTimeToMinutes(b.time || b.startTime));

    if (upcomingToday.length > 0) return upcomingToday[0];

    return null;
  }, [taughtSchedules, todayStr, getSessionTiming]);

  // 2. Next Session:
  // "the upcoming sessions in time order (the next one first) with their details and resources so the trainer can prepare, and the student list without status."
  const nextSessionsList = useMemo(() => {
    const upcoming = taughtSchedules.filter(s => getSessionTiming(s) === 'UPCOMING');
    return sortSchedulesChronologically(upcoming);
  }, [taughtSchedules, getSessionTiming]);

  // 3. Completed Sessions:
  // "today's completed sessions (add a date picker for other days) with their details and the final student list with Present/Absent status."
  const completedSessionsList = useMemo(() => {
    return taughtSchedules.filter(s => {
      if (s.date !== completedDate) return false;
      const timing = getSessionTiming(s);
      return timing === 'COMPLETED';
    }).sort((a, b) => parseTimeToMinutes(b.time || b.startTime) - parseTimeToMinutes(a.time || a.startTime));
  }, [taughtSchedules, completedDate, getSessionTiming]);

  if (isInactive) {
    return (
      <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-3xl space-y-2">
          <div className="flex items-center space-x-2 font-black text-base">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>Account Inactive</span>
          </div>
          <p className="text-xs font-semibold">
            Your trainer account status is currently set to <strong>Inactive</strong> by administration. Assigned sessions and portal resources are restricted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trainer Live Sessions</h1>
          <p className="text-xs text-slate-500 font-medium">Conduct live Google Meet sessions and manage student attendance for {trainerName}.</p>
        </div>
      </div>

      {/* THREE SLIDE BUTTONS: [ Current Session | Next Session | Completed Sessions ] */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl max-w-2xl shadow-inner gap-1">
        <button
          type="button"
          onClick={() => setActiveSlide('current')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeSlide === 'current'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Current Session</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSlide('next')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeSlide === 'next'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
          <span>Next Session ({nextSessionsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSlide('completed')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeSlide === 'completed'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Completed Sessions</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 bg-white rounded-3xl border border-slate-200">
          <PageLoader message="Loading sessions data..." />
        </div>
      ) : (
        <>
          {/* TAB 1: CURRENT SESSION */}
          {activeSlide === 'current' && (
            <div className="space-y-6">
              {!currentSession ? (
                <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                  <h3 className="text-sm font-black text-slate-800">No Current or Upcoming Session Today</h3>
                  <p className="text-xs font-semibold text-slate-500">
                    You have no active live sessions running or upcoming sessions scheduled for today ({todayStr}).
                  </p>
                  {nextSessionsList.length > 0 && (
                    <button
                      onClick={() => setActiveSlide('next')}
                      className="mt-3 inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-50 text-blue-700 font-extrabold text-xs rounded-xl hover:bg-blue-100 cursor-pointer"
                    >
                      <span>View Next Upcoming Session</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (() => {
                const timing = getSessionTiming(currentSession);
                const joinState = getScheduleJoinState(currentSession);
                const rawMeetUrl = currentSession.googleMeetUrl || currentSession.meetingUrl || currentSession.meetLink || currentSession.meetUrl || '';
                const hasValidMeet = isValidGoogleMeetUrl(rawMeetUrl);
                const batchStudents = getStudentsForBatch(currentSession);

                const asg = getAttachedResource(currentSession, 'assignment');
                const ws = getAttachedResource(currentSession, 'worksheet');
                const notes = getAttachedResource(currentSession, 'notes');
                const hasResources = Boolean(asg || ws || notes);

                return (
                  <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-6">
                    {/* Header: Date, time slot, course, batch, status */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                            timing === 'LIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {timing === 'LIVE' ? '● Live Now' : 'Earliest Upcoming Today'}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                            {currentSession.time}
                          </span>
                          {currentSession.date && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                              {currentSession.date}
                            </span>
                          )}
                          <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                            Batch: {currentSession.batch}
                          </span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900">{currentSession.title}</h2>
                        <p className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                          <span>Course: {currentSession.course}</span>
                        </p>
                      </div>

                      {/* Action Buttons: Join Meeting / Copy Meet Link */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {joinState.enabled ? (
                          <button 
                            type="button"
                            onClick={() => handleStartSession(currentSession)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md text-xs flex items-center space-x-2 cursor-pointer transition-transform active:scale-95"
                          >
                            <Video className="w-4 h-4 fill-current" />
                            <span>Join Meeting</span>
                          </button>
                        ) : (
                          <button 
                            type="button"
                            disabled={true}
                            className="bg-slate-200 text-slate-400 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 border border-slate-300 cursor-not-allowed"
                          >
                            <Lock className="w-4 h-4" />
                            <span>{joinState.label.replace('Join opens at', 'Starts at')}</span>
                          </button>
                        )}

                        <button 
                          type="button"
                          disabled={!hasValidMeet}
                          onClick={() => handleCopyLink(currentSession)}
                          className={`font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 border ${
                            hasValidMeet
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>{copiedId === currentSession.id ? 'Copied!' : 'Copy Meet Link'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Resources Section (VIEW-ONLY with no download button) */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Classroom Resources (View-Only)</span>
                      </div>
                      {hasResources ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {asg && (
                            <button
                              type="button"
                              onClick={() => setViewerFile(asg)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              <span>View Assignment</span>
                            </button>
                          )}
                          {ws && (
                            <button
                              type="button"
                              onClick={() => setViewerFile(ws)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              <span>View Worksheet</span>
                            </button>
                          )}
                          {notes && (
                            <button
                              type="button"
                              onClick={() => setViewerFile(notes)}
                              className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-600" />
                              <span>View Notes</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-slate-400">
                          No classroom resources attached to this session.
                        </p>
                      )}
                    </div>

                    {/* Student List Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Enrolled Students ({batchStudents.length})
                          </h4>
                        </div>
                        {timing === 'LIVE' && (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Auto-refreshing live attendance
                          </span>
                        )}
                      </div>

                      {batchStudents.length === 0 ? (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs font-semibold text-slate-400">
                          No students currently enrolled in batch {currentSession.batch}.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                <th className="py-2.5 px-4 w-12">#</th>
                                <th className="py-2.5 px-4">Student Name</th>
                                <th className="py-2.5 px-4">Email</th>
                                <th className="py-2.5 px-4 w-40">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {batchStudents.map((std, idx) => {
                                const attRec = getStudentAttendanceRecord(currentSession.id, std);
                                const isPresent = (attRec?.status || '').toUpperCase() === 'PRESENT';

                                return (
                                  <tr key={std.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-3 px-4 font-mono text-slate-400 text-xs">{idx + 1}</td>
                                    <td className="py-3 px-4 font-black text-slate-900">{std.name}</td>
                                    <td className="py-3 px-4 text-slate-500">{std.email}</td>
                                    <td className="py-3 px-4">
                                      {/* Requirement: The Status column ("Joined" / "Not joined") is shown only after the session has started; before the start the status cells are blank */}
                                      {timing === 'UPCOMING' ? (
                                        <span className="text-slate-300 font-normal">—</span>
                                      ) : timing === 'LIVE' ? (
                                        isPresent ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span>Joined</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                            <span>Not joined</span>
                                          </span>
                                        )
                                      ) : (
                                        // Completed
                                        isPresent ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span>Present</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                            <AlertCircle className="w-3 h-3 text-rose-600" />
                                            <span>Absent</span>
                                          </span>
                                        )
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: NEXT SESSION */}
          {activeSlide === 'next' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">Upcoming Teaching Sessions</h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Chronological order (next one first) with lesson resources and student roster.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                  {nextSessionsList.length} Upcoming
                </span>
              </div>

              {nextSessionsList.length === 0 ? (
                <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center text-xs font-bold text-slate-400">
                  No upcoming teaching sessions scheduled.
                </div>
              ) : (
                nextSessionsList.map((sch, schIdx) => {
                  const rawMeetUrl = sch.googleMeetUrl || sch.meetingUrl || sch.meetLink || sch.meetUrl || '';
                  const hasValidMeet = isValidGoogleMeetUrl(rawMeetUrl);
                  const batchStudents = getStudentsForBatch(sch);

                  const asg = getAttachedResource(sch, 'assignment');
                  const ws = getAttachedResource(sch, 'worksheet');
                  const notes = getAttachedResource(sch, 'notes');
                  const hasResources = Boolean(asg || ws || notes);

                  return (
                    <div key={sch.id || schIdx} className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                      {/* Session Info Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              {schIdx === 0 ? 'Next Session' : `Upcoming #${schIdx + 1}`}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                              {sch.time}
                            </span>
                            {sch.date && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                                {sch.date}
                              </span>
                            )}
                            <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                              Batch: {sch.batch}
                            </span>
                          </div>
                          <h4 className="text-lg font-black text-slate-900">{sch.title}</h4>
                          <p className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                            <span>Course: {sch.course}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            disabled={!hasValidMeet}
                            onClick={() => handleCopyLink(sch)}
                            className={`font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 border ${
                              hasValidMeet
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>{copiedId === sch.id ? 'Copied!' : 'Copy Meet Link'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Resources (View-Only) */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                        <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Preparation Resources (View-Only)</span>
                        </div>
                        {hasResources ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {asg && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(asg)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                <span>View Assignment</span>
                              </button>
                            )}
                            {ws && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(ws)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>View Worksheet</span>
                              </button>
                            )}
                            {notes && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(notes)}
                                className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-purple-600" />
                                <span>View Notes</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-slate-400">
                            No resources attached for this upcoming session.
                          </p>
                        )}
                      </div>

                      {/* Student List WITHOUT status column (Requirement: and the student list without status) */}
                      <div className="space-y-2.5">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            Roster ({batchStudents.length} Students)
                          </h5>
                        </div>

                        {batchStudents.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 font-semibold border border-slate-200">
                            No students enrolled in this batch.
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                  <th className="py-2.5 px-4 w-12">#</th>
                                  <th className="py-2.5 px-4">Student Name</th>
                                  <th className="py-2.5 px-4">Email</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {batchStudents.map((std, sIdx) => (
                                  <tr key={std.id || sIdx} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-2.5 px-4 font-mono text-slate-400 text-xs">{sIdx + 1}</td>
                                    <td className="py-2.5 px-4 font-black text-slate-900">{std.name}</td>
                                    <td className="py-2.5 px-4 text-slate-500">{std.email}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: COMPLETED SESSIONS */}
          {activeSlide === 'completed' && (
            <div className="space-y-6">
              {/* Date Picker Bar */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">Completed Sessions History</h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Review completed sessions and final student attendance records.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">Session Date:</span>
                  <input
                    type="date"
                    value={completedDate}
                    onChange={(e) => setCompletedDate(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                  />
                  {completedDate !== todayStr && (
                    <button
                      type="button"
                      onClick={() => setCompletedDate(todayStr)}
                      className="text-xs font-extrabold text-blue-600 hover:underline px-1"
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>

              {completedSessionsList.length === 0 ? (
                <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center text-xs font-bold text-slate-400">
                  No completed sessions found for {completedDate}.
                </div>
              ) : (
                completedSessionsList.map((sch, schIdx) => {
                  const batchStudents = getStudentsForBatch(sch);
                  const asg = getAttachedResource(sch, 'assignment');
                  const ws = getAttachedResource(sch, 'worksheet');
                  const notes = getAttachedResource(sch, 'notes');
                  const hasResources = Boolean(asg || ws || notes);

                  return (
                    <div key={sch.id || schIdx} className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                      {/* Session Info Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                              Completed
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                              {sch.time}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                              {sch.date}
                            </span>
                            <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                              Batch: {sch.batch}
                            </span>
                          </div>
                          <h4 className="text-lg font-black text-slate-900">{sch.title}</h4>
                          <p className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                            <span>Course: {sch.course}</span>
                          </p>
                        </div>
                      </div>

                      {/* Resources (View-Only) */}
                      {hasResources && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                          <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Classroom Resources (View-Only)</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {asg && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(asg)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                <span>View Assignment</span>
                              </button>
                            )}
                            {ws && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(ws)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>View Worksheet</span>
                              </button>
                            )}
                            {notes && (
                              <button
                                type="button"
                                onClick={() => setViewerFile(notes)}
                                className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-purple-600" />
                                <span>View Notes</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Final Student List with Present/Absent status */}
                      <div className="space-y-2.5">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            Final Attendance Record ({batchStudents.length} Students)
                          </h5>
                        </div>

                        {batchStudents.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 font-semibold border border-slate-200">
                            No students enrolled in this batch.
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                  <th className="py-2.5 px-4 w-12">#</th>
                                  <th className="py-2.5 px-4">Student Name</th>
                                  <th className="py-2.5 px-4">Email</th>
                                  <th className="py-2.5 px-4 w-48">Final Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {batchStudents.map((std, sIdx) => {
                                  const attRec = getStudentAttendanceRecord(sch.id, std);
                                  const isPresent = (attRec?.status || '').toUpperCase() === 'PRESENT';

                                  return (
                                    <tr key={std.id || sIdx} className="hover:bg-slate-50/60 transition-colors">
                                      <td className="py-3 px-4 font-mono text-slate-400 text-xs">{sIdx + 1}</td>
                                      <td className="py-3 px-4 font-black text-slate-900">{std.name}</td>
                                      <td className="py-3 px-4 text-slate-500">{std.email}</td>
                                      <td className="py-3 px-4">
                                        {isPresent ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span>Present</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                            <AlertCircle className="w-3 h-3 text-rose-600" />
                                            <span>Absent</span>
                                          </span>
                                        )}
                                        {attRec?.statusChangedBy && (
                                          <div className="text-[10px] text-amber-700 font-bold mt-1">
                                            Changed by trainer{attRec.originalStatus ? ` (originally ${attRec.originalStatus})` : ''}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* View-Only Universal File Viewer Modal */}
      <UniversalFileViewerModal
        isOpen={Boolean(viewerFile)}
        onClose={() => setViewerFile(null)}
        file={viewerFile}
        hideDownload={true}
      />

    </div>
  );
}
