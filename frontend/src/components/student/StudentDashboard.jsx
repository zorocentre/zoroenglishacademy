import React, { useState, useEffect } from 'react';
import { 
  Video, FileText, HelpCircle, Award, Calendar, 
  Clock, ArrowRight, Play, CheckCircle, AlertTriangle, CalendarX 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMyFeeRecords } from '../../api/feesApi';
import { getSchedules } from '../../api/scheduleApi';
import { getAssignments, getSubmissions } from '../../api/assignmentApi';
import { getDoubts } from '../../api/doubtApi';
import { getMyAttendanceRecords } from '../../api/attendanceApi';
import PageLoader from '../common/PageLoader';

export default function StudentDashboard({ setActiveScreen }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalDue, setTotalDue] = useState(0);
  const [feeRecords, setFeeRecords] = useState([]);
  const [upcomingSession, setUpcomingSession] = useState(null);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [counts, setCounts] = useState({
    upcomingSessions: 0,
    pendingAssignments: 0,
    myDoubts: 0,
    attendanceRate: 0
  });

  const studentName = user?.name || 'Student';
  const studentEmail = user?.email || '';
  const studentId = user?.id || '';

  useEffect(() => {
    loadAllStudentData();
  }, [user]);

  const loadAllStudentData = async () => {
    try {
      const [feeRes, schRes, asgRes, subRes, dbtRes, attRes] = await Promise.all([
        getMyFeeRecords(),
        getSchedules(),
        getAssignments(user?.id || user?.email),
        getSubmissions(),
        getDoubts(),
        getMyAttendanceRecords()
      ]);

      // 1. Fees
      const allFees = feeRes?.data || [];
      const userFees = allFees.filter(r => 
        (r.studentId && (r.studentId.toLowerCase() === studentEmail.toLowerCase() || r.studentId.toLowerCase() === studentId.toLowerCase())) ||
        (r.student && (r.student.toLowerCase().includes(studentName.toLowerCase()) || studentName.toLowerCase().includes(r.student.toLowerCase())))
      );
      setFeeRecords(userFees);
      const dueSum = userFees.reduce((sum, r) => sum + (parseFloat(r.dueAmount) || 0), 0);
      setTotalDue(dueSum);

      // 2. Schedules
      const allSchedules = schRes?.data || [];
      setCounts(prev => ({ ...prev, upcomingSessions: allSchedules.length }));
      if (allSchedules.length > 0) {
        const next = allSchedules.find(s => s.status !== 'Completed') || allSchedules[0];
        setUpcomingSession(next);
      } else {
        setUpcomingSession(null);
      }

      // 3. Assignments
      const allAssignments = asgRes?.data || [];
      const allSubmissions = subRes?.data || [];
      const submittedIds = new Set(
        allSubmissions
          .filter(s => s.studentEmail?.toLowerCase() === studentEmail.toLowerCase() || s.studentName?.toLowerCase() === studentName.toLowerCase())
          .map(s => s.assignmentId)
      );

      const mappedAssignments = allAssignments.slice(0, 5).map(a => ({
        id: a.id,
        title: a.title,
        dueDate: a.dueDate || a.deadline || 'No deadline',
        status: submittedIds.has(a.id) ? 'Submitted' : 'Pending'
      }));
      setRecentAssignments(mappedAssignments);
      const pendingCount = allAssignments.filter(a => !submittedIds.has(a.id)).length;
      setCounts(prev => ({ ...prev, pendingAssignments: pendingCount }));

      // 4. Doubts
      const allDoubts = dbtRes?.data || [];
      const myDoubtsCount = allDoubts.filter(d => 
        d.studentEmail?.toLowerCase() === studentEmail.toLowerCase() || 
        d.studentName?.toLowerCase() === studentName.toLowerCase()
      ).length;
      setCounts(prev => ({ ...prev, myDoubts: myDoubtsCount }));

      // 5. Attendance
      const allAtt = attRes?.data || [];
      const myAtt = allAtt.filter(a => 
        a.studentId === studentId || 
        a.studentName?.toLowerCase() === studentName.toLowerCase()
      );
      const presentCount = myAtt.filter(a => a.status?.toUpperCase() === 'PRESENT').length;
      const attRate = myAtt.length > 0 ? Math.round((presentCount / myAtt.length) * 100) : 0;
      setCounts(prev => ({ ...prev, attendanceRate: attRate }));

    } catch (err) {
      console.error('Failed to load student dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoader fullPage message="Loading student dashboard..." />;
  }

  const studentStats = [
    { title: 'Upcoming Sessions', value: counts.upcomingSessions, icon: Video, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { title: 'Pending Assignments', value: counts.pendingAssignments, icon: FileText, color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { title: 'My Doubts', value: counts.myDoubts, icon: HelpCircle, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { title: 'Attendance', value: `${counts.attendanceRate}%`, icon: Award, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-8 bg-slate-50 min-h-screen">
      
      {/* DEDICATED FEE STATUS BOX */}
      {totalDue > 0 ? (
        <div className="bg-rose-600 text-white p-6 sm:p-7 rounded-3xl border-2 border-rose-700 shadow-xl space-y-2">
          <div className="flex items-center space-x-2 text-sm sm:text-base font-black uppercase tracking-wider">
            <AlertTriangle className="w-6 h-6 text-amber-300 shrink-0" />
            <span>⚠ Fee Due</span>
          </div>
          <div className="text-xs sm:text-sm font-bold">
            Pending Fee: <span className="text-lg sm:text-xl font-black underline">₹{totalDue.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-xs font-semibold text-rose-100">
            Please clear your outstanding fee dues with the academy office.
          </p>
        </div>
      ) : (
        <div className="bg-emerald-600 text-white p-6 sm:p-7 rounded-3xl border-2 border-emerald-700 shadow-md space-y-2">
          <div className="flex items-center space-x-2 text-sm sm:text-base font-black uppercase tracking-wider">
            <CheckCircle className="w-6 h-6 text-emerald-200 shrink-0" />
            <span>✓ No Fee Due</span>
          </div>
          <div className="text-xs sm:text-sm font-bold">
            All course fee payments are fully cleared and up to date!
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="space-y-2 max-w-xl z-10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-lg ring-4 ring-blue-100 shadow-md">
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Welcome, {studentName}
              </h1>
              <p className="text-xs text-slate-500 font-bold">Keep learning. Keep growing!</p>
            </div>
          </div>
        </div>

        {/* Motivational Right Badge Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl flex items-center space-x-4 shrink-0 shadow-xs">
          <div className="w-12 h-12 bg-amber-400 text-slate-950 rounded-xl flex items-center justify-center font-black text-xl shadow">
            💡
          </div>
          <div>
            <div className="text-xs font-black text-blue-950">"Small Steps, Big Communication"</div>
            <div className="text-[10px] font-semibold text-slate-500">Every session brings you closer to fluency</div>
          </div>
        </div>
      </div>

      {/* 4 Student Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {studentStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className={`bg-white p-5 rounded-2xl border ${stat.color} shadow-xs hover:shadow-sm transition-all space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">{stat.title}</span>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-3xl font-black text-slate-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Upcoming Session Highlight Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
            <Video className="w-4 h-4 text-blue-600" />
            <span>Upcoming Session</span>
          </h3>
          <button 
            onClick={() => setActiveScreen('student-course-learn')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            Go to My Courses (LMS)
          </button>
        </div>

        {upcomingSession ? (
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow">📅</span>
                <div>
                  <span className="text-xs font-bold text-slate-400">{upcomingSession.date}</span>
                  <h4 className="text-lg font-black text-slate-900">{upcomingSession.course || upcomingSession.title}</h4>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 pl-11">
                <span className="flex items-center space-x-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Topic: {upcomingSession.topic || upcomingSession.title}</span>
                </span>
                <span className="flex items-center space-x-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>{upcomingSession.time || '10:00 AM'}</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveScreen('student-course-learn')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-8 py-3.5 rounded-xl shadow-lg transition-transform transform hover:scale-105 flex items-center justify-center space-x-2 shrink-0 text-sm cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Go to My Courses (LMS)</span>
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 text-center py-8">
            <p className="text-xs font-semibold text-slate-500">No upcoming live sessions currently scheduled.</p>
          </div>
        )}
      </div>

      {/* Recent Assignments Widget */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Recent Assignments</span>
          </h3>
          <button 
            onClick={() => setActiveScreen('student-assignment')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            View All
          </button>
        </div>

        {recentAssignments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {recentAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-900">{assignment.title}</td>
                    <td className="py-4 px-4 text-slate-500">{assignment.dueDate}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        assignment.status === 'Pending' 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {assignment.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => setActiveScreen('student-assignment')}
                        className="text-blue-600 hover:text-blue-800 font-bold border border-blue-200 px-3.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs font-semibold text-slate-500">No assignments assigned yet.</p>
          </div>
        )}
      </div>

    </div>
  );
}
