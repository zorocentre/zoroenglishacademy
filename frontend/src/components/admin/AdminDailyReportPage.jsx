import React, { useState, useEffect } from 'react';
import { 
  Calendar, Trophy, ChevronLeft, ChevronRight, Printer, Download, 
  Users, UserCheck, Clock, CreditCard, Wallet, BookOpen, 
  FileText, CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity, Layers, Filter
} from 'lucide-react';
import { getStudents, getTrainers } from '../../api/userApi';
import { getAttendanceRecords } from '../../api/attendanceApi';
import { getFeeRecords } from '../../api/feesApi';
import { getSalaryPayments } from '../../api/salaryApi';
import { getActivityLogs } from '../../api/activityLogApi';
import { getCompetitions, getCompetitionActivityLogs } from '../../api/competitionApi';
import { exportToExcel } from '../../utils/excelExporter';
import { useWebsiteSettings } from '../../context/WebsiteSettingsContext';
import Logo from '../common/Logo';

export default function AdminDailyReportPage() {
  const { academyName, tagline } = useWebsiteSettings();
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Custom Date Range: From Date & To Date
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [feeRecords, setFeeRecords] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('ALL');
  const [selectedActionFilter, setSelectedActionFilter] = useState('ALL');
  const [selectedActorFilter, setSelectedActorFilter] = useState('ALL');
  const [activeReportTab, setActiveReportTab] = useState('all'); // 'all' | 'competitions'
  const [competitionList, setCompetitionList] = useState([]);
  const [competitionLogs, setCompetitionLogs] = useState([]);
  const [selectedCompFilter, setSelectedCompFilter] = useState('ALL');
  const [selectedEventTypeFilter, setSelectedEventTypeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [stdRes, trnRes, attRes, feeRes, salRes, logRes, compRes, compLogRes] = await Promise.all([
        getStudents(),
        getTrainers(),
        getAttendanceRecords(),
        getFeeRecords(),
        getSalaryPayments(),
        getActivityLogs(fromDate, toDate, selectedModuleFilter, selectedActionFilter, selectedActorFilter),
        getCompetitions(),
        getCompetitionActivityLogs({ fromDate, toDate, competitionId: selectedCompFilter, eventType: selectedEventTypeFilter })
      ]);
      setStudents(stdRes.data || []);
      setTrainers(trnRes.data || []);
      setAttendanceRecords(attRes.data || []);
      setFeeRecords(feeRes.data || []);
      setSalaryPayments(salRes.data || []);
      setActivityLogs(logRes.data || []);
      setCompetitionList(compRes.data || []);
      setCompetitionLogs(compLogRes.data || []);
    } catch (err) {
      console.error("Failed loading report data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [fromDate, toDate, selectedCompFilter, selectedEventTypeFilter, selectedModuleFilter, selectedActionFilter, selectedActorFilter]);

  // Quick preset shortcuts
  const setTodayRange = () => {
    setFromDate(todayStr);
    setToDate(todayStr);
  };

  const setYesterdayRange = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    setFromDate(yStr);
    setToDate(yStr);
  };

  const setThisWeekRange = () => {
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
    setFromDate(firstDay.toISOString().split('T')[0]);
    setToDate(todayStr);
  };

  // Date helper
  const formatReadableDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isBetweenRange = (dateStr) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.slice(0, 10);
    return cleanDate >= fromDate && cleanDate <= toDate;
  };

  // Filtered collections
  const filteredFees = feeRecords.filter(f => isBetweenRange(f.paymentDate || f.date));
  const filteredSalaries = salaryPayments.filter(s => isBetweenRange(s.paymentDate || s.date));
  const filteredAttendance = attendanceRecords.filter(a => isBetweenRange(a.date));

  // Key stats
  const totalEnrolledStudents = students.length || 30;
  const presentCount = filteredAttendance.length > 0 
    ? filteredAttendance.filter(a => a.status === 'PRESENT' || a.status === 'Present').length
    : Math.min(Math.round(totalEnrolledStudents * 0.8), totalEnrolledStudents);
  const absentCount = Math.max(0, totalEnrolledStudents - presentCount);
  const attendanceRate = totalEnrolledStudents > 0 ? Math.round((presentCount / totalEnrolledStudents) * 100) : 0;

  const totalFeeCollected = filteredFees.reduce((sum, f) => sum + (Number(f.amountPaid || f.amount) || 0), 0);
  const totalSalaryPaid = filteredSalaries.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const isSingleDay = fromDate === toDate;

  const groupedActivityLogs = React.useMemo(() => {
    const groups = {};
    (activityLogs || []).forEach(log => {
      const day = log.date || (log.createdAt ? log.createdAt.slice(0, 10) : 'Unknown');
      if (!groups[day]) groups[day] = [];
      groups[day].push(log);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [activityLogs]);

  const uniqueModules = [
    'ALL', 'COURSES', 'MODULES', 'BATCHES', 'STUDENTS', 'TRAINERS',
    'ATTENDANCE', 'SCHEDULES', 'ASSIGNMENTS', 'DOUBTS', 'ENQUIRIES',
    'FEES', 'EXPENSES', 'SALARY', 'NOTIFICATIONS', 'SETTINGS', 'COMPETITIONS'
  ];

  // Excel Export Handler
  const handleExportExcel = () => {
    const rangeLabel = isSingleDay ? fromDate : `${fromDate}_to_${toDate}`;
    
    // Sheet 0: Competition Activity Logs (if any)
    if (competitionLogs.length > 0) {
      const compHeaders = ['Date & Time', 'Competition', 'Event Type', 'Actor', 'Role', 'Details'];
      const compRows = competitionLogs.map(c => [
        c.createdAt || '',
        c.competitionTitle || c.competitionId || '',
        c.eventType || '',
        c.actorName || '',
        c.actorRole || '',
        c.details || ''
      ]);
      const safeAcademyName = (academyName || 'Academy').replace(/[^a-zA-Z0-9]/g, '_');
      exportToExcel(`${safeAcademyName}_Competition_Activity_${rangeLabel}.xlsx`, 'Competition Activity', compHeaders, compRows);
      return;
    }

    // Sheet 1: Activity Logs
    const logHeaders = ['Date', 'Time', 'Category', 'Action', 'Details / Description'];
    const logRows = activityLogs.map(l => [
      l.date || '',
      l.time || '',
      l.category || '',
      l.action || '',
      l.details || ''
    ]);

    // Sheet 2: Fees Collected
    const feeHeaders = ['Date', 'Student Name', 'Course', 'Amount Paid', 'Payment Method', 'Reference No', 'Status'];
    const feeRows = filteredFees.map(f => [
      f.paymentDate || f.date || '',
      f.studentName || '',
      f.course || '',
      Number(f.amountPaid || f.amount) || 0,
      f.paymentMethod || '',
      f.transactionId || 'N/A',
      f.status || 'PAID'
    ]);

    const safeAcademyName = (academyName || 'Academy').replace(/[^a-zA-Z0-9]/g, '_');
    exportToExcel(`${safeAcademyName}_Daily_Report_${rangeLabel}.xlsx`, 'Activity Logs', logHeaders, logRows);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header & Range Controls (Hidden on Print) */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              <span>Admin Daily Activity & Operations Report</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Granular activity tracking, date range selection, operational overview, and Excel downloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Report Sub-Tabs: Operations Overview vs Competition Activity */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveReportTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeReportTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Academy Operations Report</span>
          </button>
          <button
            onClick={() => setActiveReportTab('competitions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeReportTab === 'competitions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Competition Operations & Activity</span>
            {competitionLogs.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeReportTab === 'competitions' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {competitionLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Date Range Selector Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            
            <div className="flex items-center space-x-2">
              <label className="font-bold text-slate-600">From Date:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (e.target.value > toDate) setToDate(e.target.value);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="font-bold text-slate-600">To Date:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  if (e.target.value < fromDate) setFromDate(e.target.value);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>

          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={setTodayRange}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                isSingleDay && fromDate === todayStr ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Today
            </button>

            <button
              onClick={setYesterdayRange}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer"
            >
              Yesterday
            </button>

            <button
              onClick={setThisWeekRange}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer"
            >
              This Week
            </button>
          </div>
        </div>
      </div>

      {/* PRINTABLE / DISPLAYABLE DAILY REPORT CONTAINER */}
      <div id="printable-daily-report" className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-md space-y-8 print:p-0 print:border-none print:shadow-none print:rounded-none">
        
        {/* Printable Letterhead */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <Logo size="w-12 h-12" alt={academyName} />
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">{academyName}</h2>
              <p className="text-xs text-blue-600 font-bold tracking-wide">
                {activeReportTab === 'competitions' ? 'Daily Competition Operations & Activity Report' : 'Daily Academy Operations & Activity Report'}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">{tagline}</p>
            </div>
          </div>

          <div className="text-left sm:text-right bg-slate-50 p-3 rounded-2xl border border-slate-100 print:bg-transparent print:p-0">
            <div className="text-xs font-black text-slate-900">REPORT PERIOD</div>
            <div className="text-sm font-extrabold text-blue-700">
              {isSingleDay ? formatReadableDate(fromDate) : `${formatReadableDate(fromDate)} — ${formatReadableDate(toDate)}`}
            </div>
            <div className="text-[10px] text-slate-400">Generated on: {new Date().toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        {activeReportTab === 'competitions' ? (
          /* COMPETITION ACTIVITY TAB CONTENT */
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 text-xs">
                  <label className="font-bold text-slate-600">Competition:</label>
                  <select
                    value={selectedCompFilter}
                    onChange={(e) => setSelectedCompFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="ALL">All Competitions</option>
                    {competitionList.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <label className="font-bold text-slate-600">Event Type:</label>
                  <select
                    value={selectedEventTypeFilter}
                    onChange={(e) => setSelectedEventTypeFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="ALL">All Event Types</option>
                    <option value="COMPETITION_CREATED">Competition Created</option>
                    <option value="COMPETITION_UPDATED">Competition Updated</option>
                    <option value="ASSESSMENT_PUBLISHED">Assessment Published</option>
                    <option value="SET_TRAINER_ASSIGNED">Trainer / Set Assigned</option>
                    <option value="REGISTRATION_CREATED">Candidate Registration</option>
                    <option value="EVALUATION_SAVED">Evaluation Saved</option>
                  </select>
                </div>
              </div>

              <div className="text-xs font-bold text-slate-500">
                Found {competitionLogs.length} activity event(s)
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Events</span>
                <span className="text-xl font-black text-slate-900">{competitionLogs.length}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Logged Actions</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Registrations</span>
                <span className="text-xl font-black text-indigo-700">
                  {competitionLogs.filter(l => l.eventType?.includes('REGISTRATION')).length}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Candidate Signups</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Assessments</span>
                <span className="text-xl font-black text-blue-700">
                  {competitionLogs.filter(l => l.eventType?.includes('ASSESSMENT') || l.eventType?.includes('QUESTION')).length}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Published & Edited</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Trainers & Sets</span>
                <span className="text-xl font-black text-emerald-700">
                  {competitionLogs.filter(l => l.eventType?.includes('SET') || l.eventType?.includes('TRAINER') || l.eventType?.includes('EVALUATION')).length}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Evaluations & Allocations</span>
              </div>
            </div>

            {/* Daily Grouped Activity Feed */}
            {competitionLogs.length === 0 ? (
              <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-400 font-bold text-xs">
                No competition activity recorded for the selected date range ({fromDate} to {toDate}).
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(
                  competitionLogs.reduce((groups, log) => {
                    const day = (log.createdAt || '').slice(0, 10) || 'Recent';
                    if (!groups[day]) groups[day] = [];
                    groups[day].push(log);
                    return groups;
                  }, {})
                ).map(([day, logs]) => (
                  <div key={day} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{formatReadableDate(day)}</span>
                      </div>
                      <span className="text-[11px] font-extrabold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        {logs.length} event(s)
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 uppercase font-bold text-[11px]">
                            <th className="py-3 px-4">Time</th>
                            <th className="py-3 px-4">Competition</th>
                            <th className="py-3 px-4">Event Type</th>
                            <th className="py-3 px-4">Actor</th>
                            <th className="py-3 px-4">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                                {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900 max-w-[180px] truncate">
                                {log.competitionTitle || log.competitionId}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                  log.eventType?.includes('REGISTRATION')
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : log.eventType?.includes('PUBLISHED')
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : log.eventType?.includes('SET') || log.eventType?.includes('TRAINER')
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {log.eventType}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-800">{log.actorName || 'System'}</span>
                                {log.actorRole && <span className="text-[10px] text-slate-400 block">({log.actorRole})</span>}
                              </td>
                              <td className="py-3 px-4 text-slate-600 whitespace-normal max-w-md">
                                {log.details}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
          {/* SECTION 1: OVERVIEW & KEY PERFORMANCE SUMMARY */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-l-4 border-blue-600 pl-3">
            1. Operations & Performance Summary
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Students</span>
              <span className="text-xl font-black text-slate-900">{students.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Enrolled Learners</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Active Trainers</span>
              <span className="text-xl font-black text-slate-900">{trainers.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Faculty Members</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Activity Events</span>
              <span className="text-xl font-black text-blue-700">{activityLogs.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Recorded Changes</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Fee Revenue</span>
              <span className="text-xl font-black text-emerald-700">₹{totalFeeCollected.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-600 font-extrabold block mt-0.5">
                {filteredFees.length} Transaction(s)
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: GRANULAR SYSTEM & ADMIN ACTIVITY LOGS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-l-4 border-purple-600 pl-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <span>2. Activity Tracking Log ({activityLogs.length} Events)</span>
            </h3>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              Grouped by Day
            </span>
          </div>

          {/* Activity Filters Toolbar */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs print:hidden">
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <label className="font-bold text-slate-600">Module:</label>
              <select
                value={selectedModuleFilter}
                onChange={(e) => setSelectedModuleFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {uniqueModules.map(m => (
                  <option key={m} value={m}>{m === 'ALL' ? 'All Modules' : m}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="font-bold text-slate-600">Event / Action:</label>
              <input
                type="text"
                placeholder="Filter by action..."
                value={selectedActionFilter === 'ALL' ? '' : selectedActionFilter}
                onChange={(e) => setSelectedActionFilter(e.target.value || 'ALL')}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none w-36"
              />
            </div>

            <div className="flex items-center space-x-2">
              <label className="font-bold text-slate-600">Actor:</label>
              <input
                type="text"
                placeholder="Filter by actor..."
                value={selectedActorFilter === 'ALL' ? '' : selectedActorFilter}
                onChange={(e) => setSelectedActorFilter(e.target.value || 'ALL')}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none w-36"
              />
            </div>

            {(selectedModuleFilter !== 'ALL' || selectedActionFilter !== 'ALL' || selectedActorFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSelectedModuleFilter('ALL');
                  setSelectedActionFilter('ALL');
                  setSelectedActorFilter('ALL');
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>

          {groupedActivityLogs.length > 0 ? (
            <div className="space-y-4">
              {groupedActivityLogs.map(([day, logsForDay]) => (
                <div key={day} className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                    <span className="font-extrabold text-xs text-slate-800 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      {formatReadableDate(day)}
                    </span>
                    <span className="bg-purple-100 text-purple-800 font-black text-[10px] px-2 py-0.5 rounded-full">
                      {logsForDay.length} {logsForDay.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-100">
                          <th className="py-2 px-4">Time</th>
                          <th className="py-2 px-4">Module</th>
                          <th className="py-2 px-4">Action</th>
                          <th className="py-2 px-4">Actor</th>
                          <th className="py-2 px-4">Description / Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
                        {logsForDay.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">{log.time}</td>
                            <td className="py-2.5 px-4">
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                {log.module || log.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-extrabold text-slate-900">{log.action}</td>
                            <td className="py-2.5 px-4 font-bold text-slate-800">{log.userName || 'Admin'}</td>
                            <td className="py-2.5 px-4 text-slate-600 whitespace-normal max-w-md">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 font-bold text-xs">
              No activity logs recorded for the selected filters.
            </div>
          )}
        </div>

        {/* SECTION 3: TRAINER FACULTY ACTIVITY */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-l-4 border-indigo-600 pl-3">
            3. Trainer Faculty Roster
          </h3>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100 text-slate-600 uppercase font-bold text-[11px]">
                  <th className="py-3 px-4">Trainer Name</th>
                  <th className="py-3 px-4">Specialization / Expertise</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Email ID</th>
                  <th className="py-3 px-4">Faculty Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {trainers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{t.name}</td>
                    <td className="py-3 px-4 text-slate-600">{t.specialty || t.expertise || 'English Language Specialist'}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{t.phone || 'N/A'}</td>
                    <td className="py-3 px-4 text-blue-900 font-medium">{t.email || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {t.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: STUDENT FEES RECORDED IN PERIOD */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-l-4 border-teal-600 pl-3">
              4. Student Fee Payments ({filteredFees.length} Recorded)
            </h3>
            <span className="text-xs font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Total Revenue: ₹{totalFeeCollected.toLocaleString()}
            </span>
          </div>

          {filteredFees.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase font-bold text-[11px]">
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Reference No</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredFees.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-600">{formatReadableDate(f.paymentDate || f.date)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{f.studentName}</td>
                      <td className="py-3 px-4 text-slate-600">{f.course}</td>
                      <td className="py-3 px-4 font-black text-emerald-700">₹{Number(f.amountPaid || f.amount).toLocaleString()}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">{f.paymentMethod}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500">{f.transactionId || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {f.status || 'PAID'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium text-center">
              No student fee payments recorded within selected date range ({fromDate} to {toDate}).
            </div>
          )}
        </div>

        {/* SECTION 5: TRAINER SALARY DISBURSEMENTS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-l-4 border-purple-600 pl-3">
              5. Trainer Salary Disbursements ({filteredSalaries.length} Recorded)
            </h3>
            <span className="text-xs font-black text-purple-900 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              Total Salary Paid: ₹{totalSalaryPaid.toLocaleString()}
            </span>
          </div>

          {filteredSalaries.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase font-bold text-[11px]">
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Trainer Name</th>
                    <th className="py-3 px-4">Salary Month</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Reference ID</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredSalaries.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-600">{formatReadableDate(s.paymentDate || s.date)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{s.trainerName}</td>
                      <td className="py-3 px-4 font-bold text-purple-900">{s.salaryMonth}</td>
                      <td className="py-3 px-4 font-black text-purple-700">₹{Number(s.amount).toLocaleString()}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">{s.paymentMethod}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500">{s.referenceId || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium text-center">
              No trainer salary disbursements recorded within selected date range ({fromDate} to {toDate}).
            </div>
          )}
        </div>

        {/* SECTION 6: CONSOLIDATED SUMMARY & SIGN OFF */}
        <div className="pt-6 border-t-2 border-slate-200 space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-l-4 border-slate-800 pl-3">
            6. Consolidated Financial & Operations Sign-off
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Admin Logs</span>
              <span className="text-base font-black text-slate-900">{activityLogs.length}</span>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Fees Revenue</span>
              <span className="text-base font-black text-teal-700">₹{totalFeeCollected.toLocaleString()}</span>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Salary Disbursed</span>
              <span className="text-base font-black text-purple-700">₹{totalSalaryPaid.toLocaleString()}</span>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Net Period Flow</span>
              <span className={`text-base font-black ${totalFeeCollected >= totalSalaryPaid ? 'text-emerald-700' : 'text-rose-700'}`}>
                ₹{(totalFeeCollected - totalSalaryPaid).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="pt-8 flex justify-between items-end text-xs font-bold text-slate-500">
            <div>
              <p>Report Generated By: System Administrator</p>
              <p className="text-[10px] text-slate-400 font-normal">{academyName} Digital Management System</p>
            </div>
            <div className="text-right border-t border-slate-400 pt-2 w-44 text-center text-slate-700 font-black">
              Authorized Signature
            </div>
          </div>
        </div>

          </>
        )}
      </div>

    </div>
  );
}
