import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle, Calendar, Clock, User, BookOpen } from 'lucide-react';
import { getStudentAttendance } from '../../api/attendanceApi';
import { getStudentEnrolledCourses } from '../../api/enrollmentApi';
import { getSchedules } from '../../api/scheduleApi';
import { useAuth } from '../../context/AuthContext';
import { getSessionEndDateTime, getNowInKolkata, syncServerTime } from '../../utils/scheduleSortUtil';
import PageLoader from '../common/PageLoader';

export default function StudentAttendancePage({ setActiveScreen }) {
  const { user } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  const [isRecordedOnly, setIsRecordedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const studentIdentifier = user?.id || user?.email;

  useEffect(() => {
    async function loadData() {
      if (!studentIdentifier) return;
      setLoading(true);
      try {
        await syncServerTime();
        const [attRes, coursesRes, schRes] = await Promise.all([
          getStudentAttendance(studentIdentifier),
          getStudentEnrolledCourses(studentIdentifier),
          getSchedules()
        ]);

        const attList = Array.isArray(attRes?.data) ? attRes.data : [];
        const enrolled = Array.isArray(coursesRes) ? coursesRes : [];
        const schedules = Array.isArray(schRes?.data) ? schRes.data : [];

        setAttendanceRecords(attList);
        setEnrolledCourses(enrolled);
        setAllSchedules(schedules);

        if (enrolled.length > 0 && enrolled.every(c => c.mode === 'Recorded')) {
          setIsRecordedOnly(true);
        } else {
          setIsRecordedOnly(false);
        }
      } catch (err) {
        console.error('Failed to load attendance page data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [studentIdentifier]);

  const nowInKolkata = getNowInKolkata();
  const nowMs = nowInKolkata.getTime();

  // Find finished sessions for enrolled courses/batches
  const finishedSessions = [];
  const processedScheduleIds = new Set();

  allSchedules.forEach(sch => {
    // Check if session belongs to student's enrolled courses/batches
    const matchesEnrollment = enrolledCourses.some(c => {
      const courseMatch = (c.id && sch.courseId && c.id === sch.courseId) ||
        (c.title && sch.course && c.title.toLowerCase().trim() === sch.course.toLowerCase().trim());
      const batchMatch = (c.batchId && sch.batchId && c.batchId === sch.batchId) ||
        (c.batchName && sch.batch && c.batchName.toLowerCase().trim() === sch.batch.toLowerCase().trim());
      return courseMatch || batchMatch;
    });

    if (!matchesEnrollment) return;

    // Check if session is finished
    const end = getSessionEndDateTime(sch.date, sch.time);
    const endMs = end ? end.getTime() : 0;
    if (nowMs < endMs) return; // session not finished yet

    processedScheduleIds.add(sch.id);

    // Look for matching attendance record
    const att = attendanceRecords.find(r => r.scheduleId === sch.id);
    const status = att?.status ? (att.status.toLowerCase() === 'present' ? 'Present' : 'Absent') : 'Absent';

    const resolvedTrainer = (!sch.trainer || sch.trainer === 'STUDENT_JOIN') ? '-' : sch.trainer;
    finishedSessions.push({
      id: sch.id,
      courseId: sch.courseId,
      course: sch.course || enrolledCourses.find(c => c.id === sch.courseId)?.title || 'English Communication',
      date: sch.date,
      time: sch.time || '10:00 AM - 11:00 AM',
      topic: sch.topic || sch.title || 'Live Interactive Class',
      trainer: resolvedTrainer,
      status,
      joinedAt: att?.joinedAt || att?.createdAt || null
    });
  });

  // Also include any standalone attendance records that didn't match a schedule directly
  attendanceRecords.forEach(att => {
    if (att.scheduleId && processedScheduleIds.has(att.scheduleId)) return;
    const resolvedCourse = att.course 
      || enrolledCourses.find(c => c.id === att.courseId)?.title 
      || att.courseName 
      || (att.courseId && !att.courseId.startsWith('crs_') ? att.courseId : 'Enrolled Course');
    
    let resolvedTrainer = att.trainer;
    if (!resolvedTrainer || resolvedTrainer === 'STUDENT_JOIN') {
      resolvedTrainer = (att.recordedBy && att.recordedBy !== 'STUDENT_JOIN') ? att.recordedBy : '-';
    }

    finishedSessions.push({
      id: att.id,
      courseId: att.courseId,
      course: resolvedCourse,
      date: att.date || '-',
      time: att.time || 'Completed Session',
      topic: att.remarks || att.topic || 'Classroom Session',
      trainer: resolvedTrainer,
      status: (att.status || '').toLowerCase() === 'present' ? 'Present' : 'Absent',
      joinedAt: att.joinedAt || att.createdAt || null
    });
  });

  // Sort chronologically descending (newest first)
  finishedSessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // Filter by selected course
  const displayedSessions = finishedSessions.filter(s => {
    if (selectedCourseFilter === 'All') return true;
    return s.courseId === selectedCourseFilter || s.course.toLowerCase().trim() === selectedCourseFilter.toLowerCase().trim();
  });

  const totalSessions = displayedSessions.length;
  const presentCount = displayedSessions.filter(r => r.status === 'Present').length;
  const absentCount = displayedSessions.filter(r => r.status === 'Absent').length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      <button 
        onClick={() => setActiveScreen('student-dash')}
        className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Attendance History</h1>
          <p className="text-xs text-slate-500 font-medium">Recorded live class session attendance for {user?.name || 'Student'}.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Course filter dropdown */}
          {enrolledCourses.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter Course:</span>
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-blue-600 cursor-pointer"
              >
                <option value="All">All Courses</option>
                {enrolledCourses.map(c => (
                  <option key={c.id} value={c.title}>{c.title}</option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-2xl text-xs font-black inline-flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Present: {presentCount} / {totalSessions} Sessions ({attendanceRate}%)</span>
          </div>
        </div>
      </div>

      {isRecordedOnly && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-bold flex items-center gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-extrabold text-sm text-amber-950">Not Applicable for Recorded-Only Courses</p>
            <p className="font-medium text-amber-800 mt-0.5">
              Live attendance tracking is not applicable for Recorded-only courses. Your progress is measured through completed recorded video modules.
            </p>
          </div>
        </div>
      )}

      {/* Attendance Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs border-l-4 border-l-blue-600">
          <p className="text-xs font-bold text-slate-500">Finished Sessions</p>
          <p className="text-xl font-black text-slate-900 mt-1">{totalSessions} <span className="text-xs font-bold text-slate-500">Total</span></p>
          <p className="text-[10px] text-blue-600 font-bold mt-0.5">Live Classes Completed</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs border-l-4 border-l-emerald-600">
          <p className="text-xs font-bold text-slate-500">Attendance Rate</p>
          <p className="text-xl font-black text-emerald-700 mt-1">{attendanceRate}%</p>
          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">({presentCount} of {totalSessions} Attended)</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs border-l-4 border-l-teal-500">
          <p className="text-xs font-bold text-slate-500">Present Count</p>
          <p className="text-xl font-black text-teal-700 mt-1">{presentCount} Sessions</p>
          <p className="text-[10px] text-teal-600 font-bold mt-0.5">Attended</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs border-l-4 border-l-rose-500">
          <p className="text-xs font-bold text-slate-500">Absent / Missed</p>
          <p className="text-xl font-black text-rose-700 mt-1">{absentCount} Sessions</p>
          <p className="text-[10px] text-rose-600 font-bold mt-0.5">Missed Classes</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Topic</th>
                <th className="py-3 px-4">Trainer</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center">
                    <PageLoader message="Loading attendance history..." />
                  </td>
                </tr>
              ) : displayedSessions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 font-medium">
                    No finished sessions found.
                  </td>
                </tr>
              ) : (
                displayedSessions.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 font-bold text-blue-900">{rec.course}</td>
                    <td className="py-4 px-4 text-slate-600">{rec.date}</td>
                    <td className="py-4 px-4 text-slate-500 font-mono">{rec.time}</td>
                    <td className="py-4 px-4 font-bold text-slate-800">{rec.topic}</td>
                    <td className="py-4 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {rec.trainer}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                        rec.status === 'Present'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
