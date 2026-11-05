import { formatIstTime } from '../../utils/dateFormatter';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Users, UserCheck, Calendar, Download, BookOpen, Layers, Search, Clock, Check, AlertCircle } from 'lucide-react';
import { getAttendanceRecords, getTrainerAttendanceRecords, updateStudentRemark, updateTrainerRemark } from '../../api/attendanceApi';
import { getStudents, getTrainers } from '../../api/userApi';
import { getCourses } from '../../api/courseApi';
import { getBatches } from '../../api/batchApi';
import { getSchedules } from '../../api/scheduleApi';
import { exportToExcel } from '../../utils/excelExporter';
import { getNowInKolkata, getSessionStartDateTime, getSessionEndDateTime, syncServerTime } from '../../utils/scheduleSortUtil';
import PageLoader from '../common/PageLoader';

export default function AdminAttendancePage({ setActiveScreen }) {
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'trainers'
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterAllDates, setFilterAllDates] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [searchSchedule, setSearchSchedule] = useState('');

  const [allRecords, setAllRecords] = useState([]);
  const [trainerRecords, setTrainerRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Remarks state: key -> remark string
  const [studentRemarks, setStudentRemarks] = useState({});
  const [trainerRemarks, setTrainerRemarks] = useState({});
  const [savedIndicator, setSavedIndicator] = useState({}); // key -> boolean
  const debounceTimers = useRef({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await syncServerTime();
      const [attRes, trAttRes, stdRes, trnRes, crsRes, bRes, schRes] = await Promise.all([
        getAttendanceRecords(),
        getTrainerAttendanceRecords(),
        getStudents(),
        getTrainers(),
        getCourses(),
        getBatches(),
        getSchedules()
      ]);

      const attList = attRes.data || [];
      const trList = trAttRes.data || [];
      setAllRecords(attList);
      setTrainerRecords(trList);
      setStudents(stdRes.data || []);
      setTrainers(trnRes.data || []);

      // Filter courses: Only ONLINE and HYBRID (Requirement P2.A.1, P2.B.1: Recorded courses never appear)
      const liveCourses = (crsRes.data || []).filter(c => {
        const mode = (c.mode || '').toLowerCase();
        return mode === 'online' || mode === 'hybrid';
      });
      setCourses(liveCourses);
      const liveCourseIds = new Set(liveCourses.map(c => c.id));
      const liveCourseTitles = new Set(liveCourses.map(c => (c.title || '').toLowerCase().trim()));

      // Filter batches belonging to online/hybrid courses
      const liveBatches = (bRes.data || []).filter(b => 
        (b.courseId && liveCourseIds.has(b.courseId)) ||
        (b.courseName && liveCourseTitles.has(b.courseName.toLowerCase().trim()))
      );
      setBatches(liveBatches);

      // Filter schedules belonging to online/hybrid courses
      const liveSchedules = (schRes.data || []).filter(s =>
        (s.courseId && liveCourseIds.has(s.courseId)) ||
        (s.course && liveCourseTitles.has(s.course.toLowerCase().trim()))
      );
      setSchedules(liveSchedules);

      // Initialize remarks
      const stRem = {};
      attList.forEach(r => {
        if (r.scheduleId && r.studentId) {
          stRem[`${r.scheduleId}_${r.studentId}`] = r.remarks || r.remark || '';
        }
      });
      setStudentRemarks(stRem);

      const trRem = {};
      trList.forEach(r => {
        if (r.scheduleId && r.trainerId) {
          trRem[`${r.scheduleId}_${r.trainerId}`] = r.remarks || r.remark || '';
        }
      });
      setTrainerRemarks(trRem);

    } catch (err) {
      console.error('Failed to load attendance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const nowInKolkata = getNowInKolkata();
  const nowMs = nowInKolkata.getTime();

  // Helper to compute session status
  const getSessionTimingState = (date, time) => {
    const start = getSessionStartDateTime(date, time);
    const end = getSessionEndDateTime(date, time);
    const startMs = start ? start.getTime() : 0;
    const endMs = end ? end.getTime() : 0;

    if (nowMs < startMs) {
      return 'UPCOMING';
    } else if (nowMs >= startMs && nowMs <= endMs) {
      return 'LIVE';
    } else {
      return 'FINISHED';
    }
  };

  // Helper to determine student automatic attendance status
  const getStudentStatus = (schedule, student) => {
    const record = allRecords.find(r => 
      r.scheduleId === schedule.id && 
      (r.studentId === student.id || (r.studentName && r.studentName.toLowerCase().trim() === student.name?.toLowerCase().trim()))
    );

    if (record && (record.status || '').toUpperCase() === 'PRESENT') {
      let timeLabel = '';
      if (record.joinedAt) {
        try {
          timeLabel = formatIstTime(record.joinedAt);
        } catch {
          timeLabel = '';
        }
      }
      return { status: 'PRESENT', record, timeLabel };
    }

    const timing = getSessionTimingState(schedule.date, schedule.time);
    if (timing === 'FINISHED') {
      return { status: 'ABSENT', record };
    } else if (timing === 'LIVE') {
      return { status: 'IN_PROGRESS', record };
    } else {
      return { status: 'UPCOMING', record };
    }
  };

  // Helper to determine trainer automatic attendance status
  const getTrainerStatus = (schedule, trainer) => {
    const record = trainerRecords.find(r =>
      r.scheduleId === schedule.id &&
      (r.trainerId === trainer.id || (r.trainerName && r.trainerName.toLowerCase().trim() === trainer.name?.toLowerCase().trim()))
    );

    if (record && (record.status || '').toUpperCase() === 'PRESENT') {
      let timeLabel = '';
      if (record.joinedAt) {
        try {
          timeLabel = formatIstTime(record.joinedAt);
        } catch {
          timeLabel = '';
        }
      }
      return { status: 'PRESENT', record, timeLabel };
    }

    const timing = getSessionTimingState(schedule.date, schedule.time);
    if (timing === 'FINISHED') {
      return { status: 'ABSENT', record };
    } else if (timing === 'LIVE') {
      return { status: 'IN_PROGRESS', record };
    } else {
      return { status: 'UPCOMING', record };
    }
  };

  // Autosave Student Remark
  const handleStudentRemarkChange = (scheduleId, studentId, text) => {
    const key = `${scheduleId}_${studentId}`;
    setStudentRemarks(prev => ({ ...prev, [key]: text }));

    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    debounceTimers.current[key] = setTimeout(async () => {
      try {
        const res = await updateStudentRemark({ scheduleId, studentId, remark: text });
        if (res.success) {
          setSavedIndicator(prev => ({ ...prev, [key]: true }));
          setTimeout(() => {
            setSavedIndicator(prev => ({ ...prev, [key]: false }));
          }, 2500);
          // Refresh records quietly
          setAllRecords(prev => {
            const idx = prev.findIndex(r => r.scheduleId === scheduleId && r.studentId === studentId);
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

  // Autosave Trainer Remark
  const handleTrainerRemarkChange = (scheduleId, trainerId, text) => {
    const key = `${scheduleId}_${trainerId}`;
    setTrainerRemarks(prev => ({ ...prev, [key]: text }));

    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    debounceTimers.current[key] = setTimeout(async () => {
      try {
        const res = await updateTrainerRemark({ scheduleId, trainerId, remark: text });
        if (res.success) {
          setSavedIndicator(prev => ({ ...prev, [key]: true }));
          setTimeout(() => {
            setSavedIndicator(prev => ({ ...prev, [key]: false }));
          }, 2500);
          setTrainerRecords(prev => {
            const idx = prev.findIndex(r => r.scheduleId === scheduleId && r.trainerId === trainerId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = res.data;
              return updated;
            }
            return [...prev, res.data];
          });
        }
      } catch (err) {
        console.error('Failed to autosave trainer remark:', err);
      }
    }, 800);
  };

  // Filter courses by active tab audience:
  // Students tab lists ONLY courses whose audience is Student and whose mode is Online or Hybrid;
  // Trainers tab lists ONLY courses whose audience is Trainer and whose mode is Online or Hybrid.
  // Recorded courses never appear in either list (filtered out during loadData).
  const displayedCourses = useMemo(() => {
    return courses.filter(c => {
      const aud = (c.audience || 'student').toLowerCase();
      if (activeTab === 'students') {
        return aud === 'student';
      } else {
        return aud === 'trainer';
      }
    });
  }, [courses, activeTab]);

  // Tab switch handler resets selected course, batch, and search so other audience values never linger
  const handleTabSwitch = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setSelectedCourse('');
    setSelectedBatch('');
    setSearchSchedule('');
  };

  // Batches of the chosen course for the Students tab
  const availableBatches = useMemo(() => {
    if (!selectedCourse) return [];
    const selC = courses.find(c => c.title === selectedCourse || c.id === selectedCourse);
    return batches.filter(b => 
      (selC && b.courseId === selC.id) || 
      b.courseName === selectedCourse || 
      b.courseId === selectedCourse
    );
  }, [batches, courses, selectedCourse]);

  // All student batches for grouping when no specific course is selected
  const studentBatches = useMemo(() => {
    const studentCourseIds = new Set(courses.filter(c => (c.audience || 'student').toLowerCase() === 'student').map(c => c.id));
    const studentCourseTitles = new Set(courses.filter(c => (c.audience || 'student').toLowerCase() === 'student').map(c => (c.title || '').toLowerCase().trim()));
    return batches.filter(b => 
      (b.courseId && studentCourseIds.has(b.courseId)) ||
      (b.courseName && studentCourseTitles.has((b.courseName || '').toLowerCase().trim()))
    );
  }, [batches, courses]);

  // Schedules matching filters
  const filteredSchedules = useMemo(() => {
    const validCourseIds = new Set(displayedCourses.map(c => c.id));
    const validCourseTitles = new Set(displayedCourses.map(c => (c.title || '').toLowerCase().trim()));

    return schedules.filter(sch => {
      // Must match audience of active tab
      const isTrainerSch = (sch.audience || '').toUpperCase() === 'TRAINER';
      if (activeTab === 'students' && isTrainerSch) return false;
      if (activeTab === 'trainers' && !isTrainerSch) return false;

      // Must belong to one of the displayed courses
      const matchesCourse = 
        (sch.courseId && validCourseIds.has(sch.courseId)) ||
        (sch.course && validCourseTitles.has((sch.course || '').toLowerCase().trim()));
      if (!matchesCourse) return false;

      if (!filterAllDates && selectedDate && sch.date !== selectedDate) {
        return false;
      }
      if (selectedCourse && sch.course !== selectedCourse && sch.courseId !== selectedCourse) {
        return false;
      }
      if (selectedBatch && sch.batch !== selectedBatch && sch.batchId !== selectedBatch) {
        return false;
      }
      if (searchSchedule && !sch.title.toLowerCase().includes(searchSchedule.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [schedules, displayedCourses, activeTab, filterAllDates, selectedDate, selectedCourse, selectedBatch, searchSchedule]);

  // A) STUDENTS ATTENDANCE TAB: Group BATCH-wise (Requirement P2.A.1)
  const batchWiseGroups = useMemo(() => {
    const groups = [];
    // Batches to consider:
    const targetBatches = selectedBatch 
      ? availableBatches.filter(b => b.name === selectedBatch || b.id === selectedBatch)
      : (selectedCourse ? availableBatches : studentBatches);

    targetBatches.forEach(batch => {
      // Find sessions for this batch
      const batchSchedules = filteredSchedules.filter(sch => 
        (sch.batchId && sch.batchId === batch.id) || 
        (sch.batch && sch.batch.toLowerCase().trim() === batch.name.toLowerCase().trim())
      );

      // Find students enrolled in this batch
      const batchStudents = students.filter(s => {
        if (s.courseBatches && Array.isArray(s.courseBatches)) {
          return s.courseBatches.some(cb => 
            (cb.batchId && cb.batchId === batch.id) || 
            (cb.batch && cb.batch.toLowerCase().trim() === batch.name.toLowerCase().trim())
          );
        }
        return s.batch === batch.name || s.batchId === batch.id;
      });

      if (batchSchedules.length > 0 || batchStudents.length > 0) {
        groups.push({
          batch,
          schedules: batchSchedules,
          students: batchStudents
        });
      }
    });

    return groups;
  }, [availableBatches, studentBatches, filteredSchedules, selectedBatch, selectedCourse, students]);

  // B) TRAINERS ATTENDANCE TAB: Group COURSE-wise (Requirement P2.B.1)
  const courseWiseGroups = useMemo(() => {
    const groups = [];
    const targetCourses = selectedCourse
      ? displayedCourses.filter(c => c.title === selectedCourse || c.id === selectedCourse)
      : displayedCourses;

    targetCourses.forEach(course => {
      const courseSchedules = filteredSchedules.filter(sch =>
        sch.courseId === course.id || sch.course === course.title
      );

      if (courseSchedules.length > 0) {
        groups.push({
          course,
          schedules: courseSchedules
        });
      }
    });

    return groups;
  }, [displayedCourses, filteredSchedules, selectedCourse]);

  // Summary Metrics: Students
  const studentMetrics = useMemo(() => {
    let totalInstances = 0;
    let presentCount = 0;
    let absentCount = 0;

    batchWiseGroups.forEach(bg => {
      bg.schedules.forEach(sch => {
        bg.students.forEach(std => {
          totalInstances++;
          const info = getStudentStatus(sch, std);
          if (info.status === 'PRESENT') presentCount++;
          else if (info.status === 'ABSENT') absentCount++;
        });
      });
    });

    const evaluated = presentCount + absentCount;
    const rate = evaluated > 0 ? Math.round((presentCount / evaluated) * 100) : (totalInstances > 0 ? 0 : 0);

    return { total: totalInstances, present: presentCount, absent: absentCount, rate };
  }, [batchWiseGroups, allRecords, nowMs]);

  // Summary Metrics: Trainers
  const trainerMetrics = useMemo(() => {
    let totalSessions = 0;
    let presentCount = 0;
    let absentCount = 0;

    courseWiseGroups.forEach(cg => {
      cg.schedules.forEach(sch => {
        totalSessions++;
        const trainerUser = trainers.find(t => t.id === sch.trainerId || t.name === sch.trainer) || { id: sch.trainerId, name: sch.trainer };
        const info = getTrainerStatus(sch, trainerUser);
        if (info.status === 'PRESENT') presentCount++;
        else if (info.status === 'ABSENT') absentCount++;
      });
    });

    const evaluated = presentCount + absentCount;
    const rate = evaluated > 0 ? Math.round((presentCount / evaluated) * 100) : 0;

    return { total: totalSessions, present: presentCount, absent: absentCount, rate };
  }, [courseWiseGroups, trainerRecords, trainers, nowMs]);

  // Export to Excel for Students
  const handleExportStudents = () => {
    const headers = ['Date', 'Course', 'Batch', 'Session Time', 'Topic', 'Student Name', 'Email', 'Status', 'Joined Time', 'Remark', 'Remark By'];
    const rows = [];

    batchWiseGroups.forEach(bg => {
      bg.schedules.forEach(sch => {
        bg.students.forEach(std => {
          const info = getStudentStatus(sch, std);
          const key = `${sch.id}_${std.id}`;
          const remark = studentRemarks[key] || info.record?.remarks || '';
          const remarkBy = info.record?.remarkBy || '';
          rows.push([
            sch.date,
            sch.course,
            sch.batch,
            sch.time,
            sch.title,
            std.name,
            std.email,
            info.status,
            info.timeLabel || '',
            remark,
            remarkBy
          ]);
        });
      });
    });

    exportToExcel(`Students_Automatic_Attendance_${selectedDate || 'all'}.xlsx`, 'Student Attendance', headers, rows);
  };

  // Export to Excel for Trainers
  const handleExportTrainers = () => {
    const headers = ['Date', 'Course', 'Batch', 'Session Time', 'Topic', 'Trainer Name', 'Email', 'Status', 'Joined Time', 'Remark', 'Remark By'];
    const rows = [];

    courseWiseGroups.forEach(cg => {
      cg.schedules.forEach(sch => {
        const trainerUser = trainers.find(t => t.id === sch.trainerId || t.name === sch.trainer) || { id: sch.trainerId, name: sch.trainer };
        const info = getTrainerStatus(sch, trainerUser);
        const key = `${sch.id}_${trainerUser.id}`;
        const remark = trainerRemarks[key] || info.record?.remarks || '';
        const remarkBy = info.record?.remarkBy || '';
        rows.push([
          sch.date,
          sch.course,
          sch.batch,
          sch.time,
          sch.title,
          trainerUser.name || sch.trainer,
          trainerUser.email || '',
          info.status,
          info.timeLabel || '',
          remark,
          remarkBy
        ]);
      });
    });

    exportToExcel(`Trainers_Automatic_Attendance_${selectedDate || 'all'}.xlsx`, 'Trainer Attendance', headers, rows);
  };

  if (loading) {
    return <PageLoader fullPage message="Loading attendance records..." />;
  }

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <button 
            onClick={() => setActiveScreen ? setActiveScreen('admin-dash') : null}
            className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Admin Dashboard</span>
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Automatic Attendance Management</h1>
          <p className="text-xs text-slate-500 font-medium">Fully automatic attendance tracking for live Online & Hybrid sessions.</p>
        </div>

        {/* Export Button */}
        <div>
          {activeTab === 'students' ? (
            <button
              onClick={handleExportStudents}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-2 text-xs cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Students (.xlsx)</span>
            </button>
          ) : (
            <button
              onClick={handleExportTrainers}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-2 text-xs cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Trainers (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {/* TOP SWITCH: [Students Attendance | Trainers Attendance] */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex max-w-md">
        <button
          onClick={() => handleTabSwitch('students')}
          className={`flex-1 py-3 px-6 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'students'
              ? 'bg-[#0F52BA] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Students Attendance</span>
        </button>

        <button
          onClick={() => handleTabSwitch('trainers')}
          className={`flex-1 py-3 px-6 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'trainers'
              ? 'bg-[#0F52BA] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Trainers Attendance</span>
        </button>
      </div>

      {/* FILTERS BAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Date</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterAllDates(!filterAllDates)}
              className="text-[10px] text-blue-600 font-extrabold hover:underline"
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

        <div>
          <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>Course (Online / Hybrid)</span>
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setSelectedBatch('');
            }}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="">{activeTab === 'students' ? 'All Student Courses (Online & Hybrid)' : 'All Trainer Courses (Online & Hybrid)'}</option>
            {displayedCourses.map(c => (
              <option key={c.id} value={c.title}>{c.title} ({c.mode})</option>
            ))}
          </select>
        </div>

        {activeTab === 'students' && (
          <div>
            <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Batch</span>
            </label>
            <select
              value={selectedBatch}
              disabled={!selectedCourse}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 ${
                !selectedCourse ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 cursor-pointer'
              }`}
            >
              <option value="">{selectedCourse ? 'All Batches of this Course' : 'Select a course first'}</option>
              {availableBatches.map(b => (
                <option key={b.id} value={b.name}>{b.name} ({b.courseName})</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span>Search Schedule Title</span>
          </label>
          <input
            type="text"
            placeholder="Search session title..."
            value={searchSchedule}
            onChange={(e) => setSearchSchedule(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs border-l-4 border-l-blue-600">
          <div className="text-xs font-bold text-slate-500">
            {activeTab === 'students' ? 'Total Student Sessions' : 'Total Scheduled Sessions'}
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {activeTab === 'students' ? studentMetrics.total : trainerMetrics.total}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Live-session courses</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs border-l-4 border-l-emerald-600">
          <div className="text-xs font-bold text-slate-500">Present (Joined)</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {activeTab === 'students' ? studentMetrics.present : trainerMetrics.present}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
            {(activeTab === 'students' ? studentMetrics.rate : trainerMetrics.rate)}% Attendance Rate
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs border-l-4 border-l-rose-500">
          <div className="text-xs font-bold text-slate-500">Absent (Ended without Join)</div>
          <div className="text-2xl font-black text-rose-700 mt-1">
            {activeTab === 'students' ? studentMetrics.absent : trainerMetrics.absent}
          </div>
          <div className="text-[10px] text-rose-500 font-bold mt-0.5">Automatic Absent</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs border-l-4 border-l-purple-500">
          <div className="text-xs font-bold text-slate-500">Live Active Batches</div>
          <div className="text-2xl font-black text-purple-700 mt-1">
            {batches.length}
          </div>
          <div className="text-[10px] text-purple-600 font-bold mt-0.5">Online & Hybrid Batches</div>
        </div>
      </div>

      {/* ===================== TAB A: STUDENTS ATTENDANCE (GROUPED BATCH-WISE) ===================== */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {loading ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200">
              <PageLoader message="Loading automatic student attendance records..." />
            </div>
          ) : batchWiseGroups.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs font-bold text-slate-400 space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No batch sessions found matching filters</p>
              <p className="text-xs text-slate-400">Only Online and Hybrid live courses are tracked here.</p>
            </div>
          ) : (
            batchWiseGroups.map(bg => (
              <div key={bg.batch.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
                {/* Batch Header Card */}
                <div className="p-5 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md">BATCH</span>
                      <h2 className="text-base font-black tracking-tight">{bg.batch.name}</h2>
                    </div>
                    <div className="text-xs text-blue-200 font-semibold mt-1">
                      Course: <strong>{bg.batch.courseName}</strong> • Assigned Trainer(s): <strong>{bg.batch.trainerName || 'Unassigned'}</strong>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-blue-200">
                    <span className="text-white font-black">{bg.schedules.length}</span> sessions • <span className="text-white font-black">{bg.students.length}</span> students enrolled
                  </div>
                </div>

                {/* Sessions under this Batch */}
                <div className="p-5 space-y-6">
                  {bg.schedules.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs font-semibold text-slate-400 border border-slate-200">
                      No live sessions scheduled for this batch {filterAllDates ? '' : `on ${selectedDate}`}.
                    </div>
                  ) : (
                    bg.schedules.map(sch => {
                      const timing = getSessionTimingState(sch.date, sch.time);

                      return (
                        <div key={sch.id} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                          {/* Session Info Bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-mono font-bold text-slate-600 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-blue-600" /> {sch.time}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">• {sch.date}</span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                  timing === 'LIVE'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                                    : timing === 'FINISHED'
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {timing === 'LIVE' ? '● Live Now' : timing === 'FINISHED' ? 'Completed' : 'Upcoming'}
                                </span>
                              </div>
                              <h3 className="text-sm font-black text-slate-900">{sch.title}</h3>
                              <p className="text-[11px] font-medium text-slate-500">Trainer: {sch.trainer || 'Assigned Trainer'}</p>
                            </div>
                          </div>

                          {/* Students Table for this Session */}
                          {bg.students.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 font-semibold">
                              No students currently assigned to this batch.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-white/70 text-slate-500 font-bold uppercase tracking-wider">
                                    <th className="py-2.5 px-3">Student Name</th>
                                    <th className="py-2.5 px-3">Contact Email</th>
                                    <th className="py-2.5 px-3">Automatic Status</th>
                                    <th className="py-2.5 px-3">Attendance Remarks (Autosaved)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/60 font-medium text-slate-700">
                                  {bg.students.map(std => {
                                    const info = getStudentStatus(sch, std);
                                    const key = `${sch.id}_${std.id}`;
                                    const currentRemark = studentRemarks[key] !== undefined ? studentRemarks[key] : (info.record?.remarks || '');
                                    const isSaved = savedIndicator[key];

                                    return (
                                      <tr key={std.id} className="hover:bg-white/80 transition-colors">
                                        <td className="py-3 px-3 font-bold text-slate-900">
                                          {std.name}
                                        </td>
                                        <td className="py-3 px-3 text-slate-500 font-semibold">
                                          {std.email}
                                        </td>
                                        <td className="py-3 px-3">
                                          {info.status === 'PRESENT' ? (
                                            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                              <Check className="w-3 h-3 text-emerald-600" />
                                              <span>Present {info.timeLabel ? `(${info.timeLabel})` : ''}</span>
                                            </span>
                                          ) : info.status === 'ABSENT' ? (
                                            <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                              <AlertCircle className="w-3 h-3 text-rose-600" />
                                              <span>Absent</span>
                                            </span>
                                          ) : info.status === 'IN_PROGRESS' ? (
                                            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                              <span>In progress - not joined yet</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                              <span>Upcoming</span>
                                            </span>
                                          )}
                                          {info.record?.statusChangedBy && (
                                            <div className="text-[10px] text-amber-700 font-bold mt-1">
                                              Changed by trainer{info.record?.originalStatus ? ` (originally ${info.record.originalStatus})` : ''}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-3 px-3">
                                          <div className="space-y-1 max-w-md">
                                            <div className="relative flex items-center">
                                              <input
                                                type="text"
                                                placeholder={info.status === 'ABSENT' ? "Add reason for absence (autosaves)..." : "Add remark (autosaves)..."}
                                                value={currentRemark}
                                                onChange={(e) => handleStudentRemarkChange(sch.id, std.id, e.target.value)}
                                                className={`w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 transition-colors ${
                                                  info.status === 'ABSENT' ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
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
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================== TAB B: TRAINERS ATTENDANCE (GROUPED COURSE-WISE) ===================== */}
      {activeTab === 'trainers' && (
        <div className="space-y-6">
          {loading ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200">
              <PageLoader message="Loading automatic trainer attendance records..." />
            </div>
          ) : courseWiseGroups.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs font-bold text-slate-400 space-y-2">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No live sessions found for trainers</p>
              <p className="text-xs text-slate-400">Trainers who have live classes scheduled in Online/Hybrid courses will appear here.</p>
            </div>
          ) : (
            courseWiseGroups.map(cg => (
              <div key={cg.course.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
                {/* Course Heading Header */}
                <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md">{cg.course.mode || 'LIVE'}</span>
                      <h2 className="text-base font-black tracking-tight">{cg.course.title}</h2>
                    </div>
                    <div className="text-xs text-slate-300 font-semibold mt-1">
                      Mode: <strong>{cg.course.mode}</strong> • Target Audience: <strong>{cg.course.audience || 'Student'}</strong>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-slate-300">
                    <span className="text-white font-black">{cg.schedules.length}</span> live sessions
                  </div>
                </div>

                {/* Sessions under this Course */}
                <div className="p-5 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Session Title</th>
                          <th className="py-3 px-4">Batch</th>
                          <th className="py-3 px-4">Date & Time</th>
                          <th className="py-3 px-4">Assigned Trainer</th>
                          <th className="py-3 px-4">Automatic Status</th>
                          <th className="py-3 px-4">Trainer Remarks (Autosaved)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {cg.schedules.map(sch => {
                          const trainerUser = trainers.find(t => t.id === sch.trainerId || t.name === sch.trainer) || { id: sch.trainerId, name: sch.trainer };
                          const info = getTrainerStatus(sch, trainerUser);
                          const key = `${sch.id}_${trainerUser.id}`;
                          const currentRemark = trainerRemarks[key] !== undefined ? trainerRemarks[key] : (info.record?.remarks || '');
                          const isSaved = savedIndicator[key];

                          return (
                            <tr key={sch.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3.5 px-4 font-black text-slate-900">
                                {sch.title}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md text-[10px] font-bold">
                                  {sch.batch || 'All'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{sch.date} • {sch.time}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-800">
                                <div>{trainerUser.name || sch.trainer}</div>
                                {trainerUser.email && (
                                  <div className="text-[10px] text-slate-400 font-normal">{trainerUser.email}</div>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                {info.status === 'PRESENT' ? (
                                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Present {info.timeLabel ? `(${info.timeLabel})` : ''}</span>
                                  </span>
                                ) : info.status === 'ABSENT' ? (
                                  <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                    <AlertCircle className="w-3 h-3 text-rose-600" />
                                    <span>Absent</span>
                                  </span>
                                ) : info.status === 'IN_PROGRESS' ? (
                                  <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                    <span>In progress - not joined yet</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                                    <span>Upcoming</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="space-y-1 max-w-md">
                                  <div className="relative flex items-center">
                                    <input
                                      type="text"
                                      placeholder={info.status === 'ABSENT' ? "Add remark for absence (autosaves)..." : "Add remark (autosaves)..."}
                                      value={currentRemark}
                                      onChange={(e) => handleTrainerRemarkChange(sch.id, trainerUser.id, e.target.value)}
                                      className={`w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 transition-colors ${
                                        info.status === 'ABSENT' ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
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
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
