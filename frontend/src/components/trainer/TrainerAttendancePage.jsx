import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle2, BookOpen, Layers, Check, Calendar, AlertCircle,
  Clock, Search, Lock, Edit3, X, Video, ExternalLink
} from 'lucide-react';
import { getBatches } from '../../api/batchApi';
import { getTrainerStudents } from '../../api/userApi';
import { getCourses } from '../../api/courseApi';
import { getAttendanceRecords, updateStudentRemark, correctStudentAttendance } from '../../api/attendanceApi';
import { getSchedules } from '../../api/scheduleApi';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { getNowInKolkata, getSessionStartDateTime, getSessionEndDateTime, syncServerTime } from '../../utils/scheduleSortUtil';
import PageLoader from '../common/PageLoader';

const CORRECTION_WINDOW_MINUTES = 60;

export default function TrainerAttendancePage() {
  const { user } = useAuth();
  const { showError, showSuccess } = useDialog();
  const trainerId = user?.id || '';
  const trainerName = user?.name || '';

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [students, setStudents] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);

  // Filters state
  const [selectedCourseTitle, setSelectedCourseTitle] = useState('');
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterAllDates, setFilterAllDates] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState('');

  // Remarks state
  const [remarksMap, setRemarksMap] = useState({}); // key `${schId}_${stdId}` -> text
  const [savedIndicator, setSavedIndicator] = useState({}); // key -> bool
  const debounceTimers = useRef({});

  // Correction Modal state
  const [correctionModal, setCorrectionModal] = useState({
    isOpen: false,
    schedule: null,
    student: null,
    currentStatus: '',
    targetStatus: '',
    remark: '',
    isSubmitting: false
  });

  // Current time ticker (ticks every 30 seconds to recalculate window)
  const [nowMs, setNowMs] = useState(() => getNowInKolkata().getTime());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(getNowInKolkata().getTime());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await syncServerTime();
      const [bRes, sRes, cRes, schRes, attRes] = await Promise.all([
        getBatches(),
        getTrainerStudents(),
        getCourses(),
        getSchedules(),
        getAttendanceRecords()
      ]);

      const rawCourses = cRes.data || [];
      const rawBatches = bRes.data || [];
      const rawSchedules = schRes.data || [];
      const rawStudents = (sRes.data || []).filter(s => (s.status || '').toLowerCase() !== 'inactive' && !s.isDeleted);
      const rawAttendance = attRes.data || [];

      setCourses(rawCourses);
      setBatches(rawBatches);
      setSchedules(rawSchedules);
      setStudents(rawStudents);
      setAllAttendance(rawAttendance);

      // Populate remarks
      const rMap = {};
      rawAttendance.forEach(r => {
        if (r.scheduleId && r.studentId) {
          rMap[`${r.scheduleId}_${r.studentId}`] = r.remarks || r.remark || '';
        }
      });
      setRemarksMap(rMap);
    } catch (err) {
      console.error('Failed to load trainer attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Rule 1: The Course dropdown lists ONLY courses the logged-in trainer teaches:
   * - Courses of batches where trainer is assigned in batch_trainers (batch.trainerId === user.id || batch.trainerIds.includes(user.id))
   *   OR sessions assigned to them (schedule.trainerId === user.id)
   * - Mode: Online or Hybrid (never Recorded)
   * - Audience: Student (never Trainer-audience like 'trainer-3')
   */
  const taughtCourses = useMemo(() => {
    if (!user) return [];
    const tId = user.id;
    const tName = (user.name || '').toLowerCase().trim();
    const tEmail = (user.email || '').toLowerCase().trim();

    return courses.filter(c => {
      // Must be Online or Hybrid
      const mode = (c.mode || '').toLowerCase().trim();
      if (mode !== 'online' && mode !== 'hybrid') return false;

      // Must be Student audience (never Trainer)
      const audience = (c.audience || 'student').toLowerCase().trim();
      if (audience !== 'student') return false;

      // Must be taught by this trainer
      const hasTaughtBatch = batches.some(b => {
        const matchesCourse = (b.courseId && b.courseId === c.id) ||
                              (b.courseName && b.courseName.toLowerCase().trim() === (c.title || '').toLowerCase().trim());
        if (!matchesCourse) return false;

        const isTrainer = (tId && b.trainerId === tId) ||
                          (Array.isArray(b.trainerIds) && b.trainerIds.includes(tId)) ||
                          (Array.isArray(b.trainers) && b.trainers.some(t => t.id === tId || t.trainerId === tId)) ||
                          (tName && (b.trainerName || '').toLowerCase().trim() === tName) ||
                          (tEmail && (b.trainerEmail || '').toLowerCase().trim() === tEmail);
        return isTrainer;
      });

      const hasTaughtSchedule = schedules.some(s => {
        const matchesCourse = (s.courseId && s.courseId === c.id) ||
                              (s.course && s.course.toLowerCase().trim() === (c.title || '').toLowerCase().trim());
        if (!matchesCourse) return false;

        const isTrainer = (tId && s.trainerId === tId) ||
                          (tName && (s.trainer || '').toLowerCase().trim() === tName);
        return isTrainer;
      });

      return hasTaughtBatch || hasTaughtSchedule;
    });
  }, [courses, batches, schedules, user]);

  /**
   * Rule 1b: The Batch dropdown is DISABLED until a course is selected.
   * After selecting a course it lists ONLY the batches of that course where this trainer is assigned.
   */
  const taughtBatchesForSelectedCourse = useMemo(() => {
    if (!selectedCourseTitle || !user) return [];
    const tId = user.id;
    const tName = (user.name || '').toLowerCase().trim();
    const tEmail = (user.email || '').toLowerCase().trim();

    const selectedCourseObj = taughtCourses.find(c => c.title === selectedCourseTitle);
    const selectedCourseId = selectedCourseObj?.id;

    return batches.filter(b => {
      const matchesCourse = (selectedCourseId && b.courseId === selectedCourseId) ||
                            (b.courseName && b.courseName.toLowerCase().trim() === selectedCourseTitle.toLowerCase().trim());
      if (!matchesCourse) return false;

      const isTrainer = (tId && b.trainerId === tId) ||
                        (Array.isArray(b.trainerIds) && b.trainerIds.includes(tId)) ||
                        (Array.isArray(b.trainers) && b.trainers.some(t => t.id === tId || t.trainerId === tId)) ||
                        (tName && (b.trainerName || '').toLowerCase().trim() === tName) ||
                        (tEmail && (b.trainerEmail || '').toLowerCase().trim() === tEmail);
      return isTrainer;
    });
  }, [batches, taughtCourses, selectedCourseTitle, user]);

  const handleCourseChange = (cTitle) => {
    setSelectedCourseTitle(cTitle);
    // Changing the course resets the batch
    setSelectedBatchName('');
  };

  /**
   * Schedule-wise filtering:
   * Show schedules taught by this trainer (audience Student, Online/Hybrid)
   * filtered by selected course, selected batch, selected date, and schedule search.
   */
  const filteredSchedules = useMemo(() => {
    if (!user) return [];
    const tId = user.id;
    const tName = (user.name || '').toLowerCase().trim();

    return schedules.filter(sch => {
      // Must be taught by this trainer
      const isTrainer = (tId && sch.trainerId === tId) ||
                        (tName && (sch.trainer || '').toLowerCase().trim() === tName);
      if (!isTrainer) return false;

      // Student audience only
      const aud = (sch.audience || 'STUDENT').toUpperCase();
      if (aud !== 'STUDENT') return false;

      // Date filter
      if (!filterAllDates && sch.date !== selectedDate) {
        return false;
      }

      // Course filter
      if (selectedCourseTitle) {
        const matchesCourse = (sch.course && sch.course.toLowerCase().trim() === selectedCourseTitle.toLowerCase().trim()) ||
                              (sch.courseId && taughtCourses.some(c => c.title === selectedCourseTitle && c.id === sch.courseId));
        if (!matchesCourse) return false;
      }

      // Batch filter
      if (selectedBatchName) {
        const matchesBatch = (sch.batch && sch.batch.toLowerCase().trim() === selectedBatchName.toLowerCase().trim()) ||
                             (sch.batchId && batches.some(b => b.name === selectedBatchName && b.id === sch.batchId));
        if (!matchesBatch) return false;
      }

      // Search filter
      if (scheduleSearch && scheduleSearch.trim()) {
        const q = scheduleSearch.toLowerCase().trim();
        const matchesTitle = (sch.title || '').toLowerCase().includes(q);
        const matchesBatch = (sch.batch || '').toLowerCase().includes(q);
        const matchesCourse = (sch.course || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesBatch && !matchesCourse) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort: Live now first, then upcoming (soonest first), then completed (most recent first)
      const aStart = getSessionStartDateTime(a.date, a.time);
      const bStart = getSessionStartDateTime(b.date, b.time);
      const aEnd = getSessionEndDateTime(a.date, a.time);
      const bEnd = getSessionEndDateTime(b.date, b.time);

      const aStartMs = aStart ? aStart.getTime() : 0;
      const bStartMs = bStart ? bStart.getTime() : 0;
      const aEndMs = aEnd ? aEnd.getTime() : 0;
      const bEndMs = bEnd ? bEnd.getTime() : 0;

      const aIsLive = nowMs >= aStartMs && nowMs <= aEndMs;
      const bIsLive = nowMs >= bStartMs && nowMs <= bEndMs;
      if (aIsLive && !bIsLive) return -1;
      if (!aIsLive && bIsLive) return 1;

      return bStartMs - aStartMs;
    });
  }, [schedules, user, filterAllDates, selectedDate, selectedCourseTitle, selectedBatchName, scheduleSearch, taughtCourses, batches, nowMs]);

  /**
   * Helper: Match students for a schedule's batch
   */
  const getStudentsForSchedule = (sch) => {
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
  };

  /**
   * Timing state helper
   */
  const getScheduleTiming = (sch) => {
    const start = getSessionStartDateTime(sch.date, sch.time);
    const end = getSessionEndDateTime(sch.date, sch.time);
    const startMs = start ? start.getTime() : 0;
    const endMs = end ? end.getTime() : 0;

    if (nowMs < startMs) {
      return { state: 'UPCOMING', startMs, endMs };
    } else if (nowMs >= startMs && nowMs <= endMs) {
      return { state: 'LIVE', startMs, endMs };
    } else {
      const windowEndMs = endMs + (CORRECTION_WINDOW_MINUTES * 60 * 1000);
      const isCorrectionOpen = nowMs <= windowEndMs;
      const minutesRemaining = isCorrectionOpen ? Math.max(1, Math.ceil((windowEndMs - nowMs) / 60000)) : 0;
      return { state: 'FINISHED', startMs, endMs, isCorrectionOpen, minutesRemaining };
    }
  };

  /**
   * Determine student's automatic status
   */
  const getStudentStatus = (sch, student) => {
    const record = allAttendance.find(r =>
      r.scheduleId === sch.id &&
      (r.studentId === student.id || (r.studentName && r.studentName.toLowerCase().trim() === student.name?.toLowerCase().trim()))
    );

    if (record) {
      const recStatus = (record.status || '').toUpperCase();
      if (recStatus === 'PRESENT') {
        let timeLabel = '';
        if (record.joinedAt) {
          try {
            timeLabel = new Date(record.joinedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          } catch {}
        }
        return { status: 'PRESENT', record, timeLabel };
      } else if (recStatus === 'ABSENT') {
        return { status: 'ABSENT', record };
      }
    }

    const timing = getScheduleTiming(sch);
    if (timing.state === 'FINISHED') {
      return { status: 'ABSENT', record };
    } else if (timing.state === 'LIVE') {
      return { status: 'IN_PROGRESS', record };
    } else {
      return { status: 'UPCOMING', record };
    }
  };

  /**
   * Autosave student remark (allowed once LIVE or afterwards)
   */
  const handleRemarkChange = (schId, studentId, text) => {
    const key = `${schId}_${studentId}`;
    setRemarksMap(prev => ({ ...prev, [key]: text }));

    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    debounceTimers.current[key] = setTimeout(async () => {
      try {
        const res = await updateStudentRemark({
          scheduleId: schId,
          studentId,
          remark: text
        });

        if (res.success) {
          setSavedIndicator(prev => ({ ...prev, [key]: true }));
          setTimeout(() => {
            setSavedIndicator(prev => ({ ...prev, [key]: false }));
          }, 2500);

          setAllAttendance(prev => {
            const idx = prev.findIndex(r => r.scheduleId === schId && r.studentId === studentId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = res.data;
              return updated;
            }
            return [...prev, res.data];
          });
        }
      } catch (err) {
        console.error('Failed to autosave student remark:', err);
      }
    }, 800);
  };

  /**
   * Open Correction Modal
   */
  const openCorrectionModal = (sch, student, currentStatus) => {
    const targetStatus = currentStatus === 'PRESENT' ? 'Absent' : 'Present';
    setCorrectionModal({
      isOpen: true,
      schedule: sch,
      student,
      currentStatus,
      targetStatus,
      remark: '',
      isSubmitting: false
    });
  };

  /**
   * Submit Attendance Correction with mandatory remark
   */
  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionModal.remark || !correctionModal.remark.trim()) {
      showError('A remark is mandatory when correcting attendance status.', 'Mandatory Remark Required');
      return;
    }

    setCorrectionModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      const res = await correctStudentAttendance({
        scheduleId: correctionModal.schedule.id,
        studentId: correctionModal.student.id,
        status: correctionModal.targetStatus,
        remark: correctionModal.remark.trim()
      });

      if (res.success) {
        showSuccess(`Attendance corrected to ${correctionModal.targetStatus} successfully.`);
        // Update allAttendance state with updated record
        setAllAttendance(prev => {
          const idx = prev.findIndex(r => r.scheduleId === correctionModal.schedule.id && r.studentId === correctionModal.student.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = res.data;
            return updated;
          }
          return [...prev, res.data];
        });

        // Also update local remarks map
        const key = `${correctionModal.schedule.id}_${correctionModal.student.id}`;
        setRemarksMap(prev => ({ ...prev, [key]: correctionModal.remark.trim() }));

        setCorrectionModal(prev => ({ ...prev, isOpen: false }));
      } else {
        showError(res.message || 'Failed to correct attendance.');
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message || 'Error correcting attendance.');
    } finally {
      setCorrectionModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  return (
    <div className="space-y-6 bg-slate-50 min-h-screen p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Trainer Attendance Management</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Schedule-wise session attendance, automatic join tracking, and 60-minute post-session correction window.
          </p>
        </div>
        <div className="bg-blue-50 text-blue-900 border border-blue-200 px-4 py-2 rounded-2xl text-xs font-black inline-flex items-center space-x-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Correction Window: 60 minutes after session end</span>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Date Picker */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Date</span>
              </span>
              <button
                type="button"
                onClick={() => setFilterAllDates(!filterAllDates)}
                className="text-[10px] text-blue-600 font-extrabold hover:underline cursor-pointer"
              >
                {filterAllDates ? 'Specific Date' : 'All Dates'}
              </button>
            </label>
            <input
              type="date"
              disabled={filterAllDates}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer ${
                filterAllDates ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50'
              }`}
            />
          </div>

          {/* Course Dropdown (Only taught student Online/Hybrid courses) */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Course (Taught by you)</span>
            </label>
            <select
              value={selectedCourseTitle}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="">-- All Taught Courses --</option>
              {taughtCourses.map(c => (
                <option key={c.id || c.title} value={c.title}>
                  {c.title} ({c.mode})
                </option>
              ))}
            </select>
          </div>

          {/* Batch Dropdown (DISABLED until a course is selected) */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Batch</span>
            </label>
            <select
              value={selectedBatchName}
              disabled={!selectedCourseTitle}
              onChange={(e) => setSelectedBatchName(e.target.value)}
              className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 ${
                !selectedCourseTitle ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 cursor-pointer'
              }`}
            >
              <option value="">{selectedCourseTitle ? 'All My Batches' : 'Select a course first'}</option>
              {taughtBatchesForSelectedCourse.map(b => (
                <option key={b.id || b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search by Schedule Title */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>Search Schedule Name</span>
            </label>
            <input
              type="text"
              placeholder="Search session title..."
              value={scheduleSearch}
              onChange={(e) => setScheduleSearch(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* SCHEDULE-WISE SESSIONS LIST */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200">
            <PageLoader message="Loading session attendance records..." />
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs font-bold text-slate-400 space-y-2">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No sessions found matching filters</p>
            <p className="text-xs text-slate-400">
              {filterAllDates ? 'No sessions taught by you found.' : `No sessions on ${selectedDate}. Try selecting another date or clicking "All Dates".`}
            </p>
          </div>
        ) : (
          filteredSchedules.map(sch => {
            const timing = getScheduleTiming(sch);
            const sessionStudents = getStudentsForSchedule(sch);

            return (
              <div key={sch.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                {/* Schedule Header Card */}
                <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md">
                        {sch.course}
                      </span>
                      <span className="bg-purple-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md">
                        Batch: {sch.batch || 'All'}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                        timing.state === 'LIVE'
                          ? 'bg-emerald-500 text-white animate-pulse'
                          : timing.state === 'FINISHED'
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-amber-500 text-slate-900'
                      }`}>
                        {timing.state === 'LIVE' ? '● Live Now' : timing.state === 'FINISHED' ? 'Completed' : 'Upcoming'}
                      </span>
                    </div>

                    <h2 className="text-lg font-black tracking-tight">{sch.title}</h2>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-400" /> {sch.time}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" /> {sch.date}
                      </span>
                      {sch.meetLink && (
                        <>
                          <span>•</span>
                          <a
                            href={sch.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
                          >
                            <Video className="w-3 h-3" /> Meeting Link <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Correction Window Pill in Schedule Header */}
                  {timing.state === 'FINISHED' && (
                    <div className="flex items-center">
                      {timing.isCorrectionOpen ? (
                        <div className="bg-amber-500/20 border border-amber-400 text-amber-200 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-amber-300" />
                          <div>
                            <div>Correction Window Open</div>
                            <div className="text-[10px] text-amber-300 font-medium">
                              {timing.minutesRemaining} min remaining to edit status
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-800 border border-slate-700 text-slate-400 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2">
                          <Lock className="w-4 h-4 text-slate-400" />
                          <div>
                            <div>Correction Window Closed</div>
                            <div className="text-[10px] text-slate-500 font-medium">Session attendance is read-only</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Students Attendance Table for this Schedule */}
                <div className="p-5">
                  {sessionStudents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-semibold bg-slate-50 rounded-2xl border border-slate-100">
                      No active students found in batch "{sch.batch || 'Unassigned'}".
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                            <th className="py-3 px-3 w-10">#</th>
                            <th className="py-3 px-4">Student</th>
                            <th className="py-3 px-4">Attendance Status</th>
                            <th className="py-3 px-4">Correction Action</th>
                            <th className="py-3 px-4">Remarks (Autosaved & Shared with Admin)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {sessionStudents.map((std, idx) => {
                            const info = getStudentStatus(sch, std);
                            const key = `${sch.id}_${std.id}`;
                            const currentRemark = remarksMap[key] !== undefined ? remarksMap[key] : (info.record?.remarks || '');
                            const isSaved = savedIndicator[key];
                            const isPresent = info.status === 'PRESENT';
                            const isAbsent = info.status === 'ABSENT';

                            return (
                              <tr key={std.id || idx} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                                <td className="py-3.5 px-4">
                                  <div className="font-black text-slate-900 text-sm">{std.name}</div>
                                  <div className="text-[10px] text-slate-400 font-semibold">{std.email}</div>
                                </td>

                                {/* Automatic Status */}
                                <td className="py-3.5 px-4">
                                  <div>
                                    {isPresent ? (
                                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        <span>Present {info.timeLabel ? `(${info.timeLabel})` : ''}</span>
                                      </span>
                                    ) : isAbsent ? (
                                      <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                        <AlertCircle className="w-3 h-3 text-rose-600" />
                                        <span>Absent</span>
                                      </span>
                                    ) : info.status === 'IN_PROGRESS' ? (
                                      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                        <span>In progress - not joined</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                        <span>Upcoming</span>
                                      </span>
                                    )}

                                    {info.record?.statusChangedBy && (
                                      <div className="text-[10px] text-amber-700 font-bold mt-1">
                                        Changed by {info.record.statusChangedBy}{info.record.originalStatus ? ` (originally ${info.record.originalStatus})` : ''}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Correction Action Button (60-minute window only) */}
                                <td className="py-3.5 px-4">
                                  {timing.state === 'FINISHED' && timing.isCorrectionOpen ? (
                                    <button
                                      type="button"
                                      onClick={() => openCorrectionModal(sch, std, isPresent ? 'PRESENT' : 'ABSENT')}
                                      className={`px-3 py-1.5 rounded-xl font-bold text-[11px] border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                        isPresent
                                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      }`}
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Mark {isPresent ? 'Absent' : 'Present'}</span>
                                    </button>
                                  ) : timing.state === 'FINISHED' ? (
                                    <span className="text-[10px] text-slate-400 font-bold inline-flex items-center gap-1">
                                      <Lock className="w-3 h-3 text-slate-300" /> Locked (Read-Only)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-bold">
                                      {timing.state === 'LIVE' ? 'Automatic (Join Now)' : 'Pending Start'}
                                    </span>
                                  )}
                                </td>

                                {/* Remarks Column */}
                                <td className="py-3.5 px-4">
                                  {timing.state === 'UPCOMING' ? (
                                    <span className="text-slate-400 text-xs italic">
                                      Remark available once session starts
                                    </span>
                                  ) : (
                                    <div className="space-y-1 max-w-md">
                                      <div className="relative flex items-center">
                                        <input
                                          type="text"
                                          placeholder={isAbsent ? "Add reason for absence (autosaves)..." : "Add remark for admin (autosaves)..."}
                                          value={currentRemark}
                                          onChange={(e) => handleRemarkChange(sch.id, std.id, e.target.value)}
                                          className={`w-full px-3.5 py-2 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-blue-600 ${
                                            isAbsent ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                                          }`}
                                        />
                                        {isSaved && (
                                          <span className="absolute right-2 text-emerald-600 text-[10px] font-extrabold flex items-center gap-0.5">
                                            <Check className="w-3 h-3" /> Saved
                                          </span>
                                        )}
                                      </div>
                                      {info.record?.remarkBy && (
                                        <div className="text-[10px] text-slate-400 font-semibold pl-1">
                                          by {info.record.remarkBy}
                                        </div>
                                      )}
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

      {/* ATTENDANCE CORRECTION MODAL (Mandatory Remark) */}
      {correctionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden max-h-[90dvh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Correct Student Attendance</h3>
                  <p className="text-xs text-slate-500 font-medium">Session finished within the last 60 minutes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
                <div>Student: <strong className="text-slate-900">{correctionModal.student?.name}</strong></div>
                <div>Session: <strong className="text-slate-900">{correctionModal.schedule?.title}</strong></div>
                <div>
                  Changing status from{' '}
                  <span className="font-black uppercase text-slate-600">{correctionModal.currentStatus}</span>
                  {' '}to{' '}
                  <span className={`font-black uppercase ${
                    correctionModal.targetStatus === 'Present' ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {correctionModal.targetStatus}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Mandatory Remark for Admin & Audit Log</span>
                  <span className="text-[10px] text-rose-600 font-black">* Required</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why the attendance status is being changed (e.g., student attended via phone bridge, system glitch, student left early)..."
                  value={correctionModal.remark}
                  onChange={(e) => setCorrectionModal(prev => ({ ...prev, remark: e.target.value }))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectionModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctionModal.isSubmitting || !correctionModal.remark.trim()}
                  className="px-5 py-2.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {correctionModal.isSubmitting ? 'Saving...' : 'Confirm & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
