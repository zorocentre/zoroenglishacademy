import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Video, FileText, CheckSquare, 
  HelpCircle, PlayCircle, Clock, Award, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTrainerSchedules } from '../../api/scheduleApi';
import { getAttendanceRecords } from '../../api/attendanceApi';
import { getTrainerDashboardStats } from '../../api/userApi';
import { sortSchedulesChronologically } from '../../utils/scheduleSortUtil';

function isTodayUnfinishedSchedule(schedule) {
  if (!schedule || !schedule.date) return false;
  // Scheduled date must be today in IST (Asia/Kolkata)
  const todayKolkata = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  if (schedule.date.trim() !== todayKolkata) return false;

  // If session is already completed or ended
  if (schedule.status && schedule.status.toLowerCase() === 'completed') {
    return false;
  }

  if (schedule.endAt) {
    const endMs = new Date(schedule.endAt).getTime();
    if (!isNaN(endMs) && endMs <= Date.now()) {
      return false;
    }
  }

  // Parse time "HH:mm - HH:mm" or "hh:mm AM - hh:mm PM" in Asia/Kolkata
  if (schedule.time && schedule.time.includes('-')) {
    const endPart = schedule.time.split('-')[1]?.trim();
    if (endPart) {
      const nowKolkataTimeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date());
      const nowParts = nowKolkataTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      const endMatch = endPart.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
      if (nowParts && endMatch) {
        let nowH = parseInt(nowParts[1], 10);
        const nowM = parseInt(nowParts[2], 10);
        if (nowParts[3].toUpperCase() === 'PM' && nowH < 12) nowH += 12;
        if (nowParts[3].toUpperCase() === 'AM' && nowH === 12) nowH = 0;
        const nowMinutes = nowH * 60 + nowM;

        let endH = parseInt(endMatch[1], 10);
        const endM = parseInt(endMatch[2], 10);
        const endAmpm = endMatch[3] ? endMatch[3].toUpperCase() : null;
        if (endAmpm === 'PM' && endH < 12) endH += 12;
        if (endAmpm === 'AM' && endH === 12) endH = 0;
        const endMinutes = endH * 60 + endM;

        if (nowMinutes >= endMinutes) {
          return false;
        }
      }
    }
  }

  return true;
}

export default function TrainerDashboard({ setActiveScreen }) {
  const { user } = useAuth();
  const trainerName = user?.name || '';
  const [schedules, setSchedules] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        if (!trainerName && !user?.id) {
          setSchedules([]);
          setAttendanceRecords([]);
          setStats(null);
          return;
        }
        const [schRes, attRes, statsRes] = await Promise.all([
          trainerName ? getTrainerSchedules(trainerName) : Promise.resolve({ data: [] }),
          getAttendanceRecords(),
          getTrainerDashboardStats(trainerName || user?.id)
        ]);
        if (schRes.data && Array.isArray(schRes.data)) {
          setSchedules(sortSchedulesChronologically(schRes.data));
        } else {
          setSchedules([]);
        }
        if (attRes.data && Array.isArray(attRes.data)) {
          setAttendanceRecords(attRes.data);
        } else {
          setAttendanceRecords([]);
        }
        if (statsRes && statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      }
    }
    loadDashboardData();
  }, [trainerName, user?.id]);

  const sortedDashboardSchedules = sortSchedulesChronologically(schedules);
  const todaySchedules = sortSchedulesChronologically(schedules.filter(isTodayUnfinishedSchedule));

  const conductedCount = schedules.filter(s => 
    s.status === 'Completed' || (s.endAt && new Date(s.endAt) < new Date())
  ).length;
  const totalClassesCount = schedules.length;

  const trainerScheduleIds = new Set(schedules.map(s => String(s.id)));
  const relevantAtt = (attendanceRecords || []).filter(r => 
    (r.scheduleId && trainerScheduleIds.has(String(r.scheduleId))) || 
    (r.trainer && trainerName && r.trainer.toLowerCase() === trainerName.toLowerCase())
  );
  const presentCount = relevantAtt.filter(r => r.status?.toUpperCase() === 'PRESENT').length;
  const totalAtt = relevantAtt.length;
  const attendanceRate = totalAtt > 0 
    ? Math.round((presentCount / totalAtt) * 100) 
    : (totalClassesCount > 0 ? Math.round((conductedCount / totalClassesCount) * 100) : 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 bg-slate-50 min-h-screen">
      
      {/* Header Banner - Page 1 PDF */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Good morning, {trainerName}!</span>
            <span>👋</span>
          </h1>
          <p className="text-xs text-slate-500 font-semibold">Here's your teaching overview for today.</p>
        </div>
      </div>

      {/* 4 Trainer KPI Cards - Page 1 PDF */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500">Today's Sessions</div>
          <div className="text-3xl font-black text-slate-900">{stats?.todaySessions !== undefined ? stats.todaySessions : sortedDashboardSchedules.length}</div>
          <div className="text-[11px] font-extrabold text-emerald-600">Assigned live classes</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500">My Students</div>
          <div className="text-3xl font-black text-slate-900">{stats?.myStudents ?? 0}</div>
          <div className="text-[11px] font-extrabold text-blue-600">Across {stats?.batchCount ?? 0} batch{stats?.batchCount === 1 ? '' : 'es'}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500">Pending Corrections</div>
          <div className="text-3xl font-black text-slate-900">{stats?.pendingCorrections ?? 0}</div>
          <div className="text-[11px] font-extrabold text-rose-600">Assignments</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500">Doubts to Answer</div>
          <div className="text-3xl font-black text-slate-900">{stats?.doubtsToAnswer ?? 0}</div>
          <div className="text-[11px] font-extrabold text-purple-600">From students</div>
        </div>

      </div>

      {/* Main Grid: Today's Schedule + My Performance (Page 1 PDF) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        
        {/* Today's Schedule (Left 7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900">Today's Schedule</h3>
            <button 
              onClick={() => setActiveScreen('trainer-schedule')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {todaySchedules.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                No sessions scheduled for today.
              </div>
            ) : (
              todaySchedules.map((item) => (
                <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black text-blue-900">{item.time}</span>
                    <h4 className="text-sm font-black text-slate-900 mt-0.5">{item.title}</h4>
                    <p className="text-[11px] font-semibold text-slate-500">{item.course} {item.batch ? `• ${item.batch}` : ''}</p>
                  </div>
                  <button 
                    onClick={() => setActiveScreen('trainer-sessions')}
                    className="bg-blue-600 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-xs hover:bg-blue-700 cursor-pointer"
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My Performance (Right 5 cols) - Gauge Ring */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
            My Performance (This Month)
          </h3>

          <div className="flex flex-col items-center justify-center space-y-4 py-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray={`${stats?.performancePercent !== undefined ? stats.performancePercent : attendanceRate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-2xl font-black text-slate-900">{stats?.performancePercent !== undefined ? stats.performancePercent : attendanceRate}%</span>
            </div>

            <div className="w-full space-y-3 pt-2 text-xs font-bold text-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span>Classes Conducted</span>
                </div>
                <span className="font-extrabold text-slate-900">{stats?.conductedClasses !== undefined ? stats.conductedClasses : conductedCount} / {stats?.totalClasses !== undefined ? stats.totalClasses : totalClassesCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Assignments Corrected</span>
                </div>
                <span className="font-extrabold text-slate-900">{stats?.correctedAssignments !== undefined ? stats.correctedAssignments : 0} / {stats?.totalAssignments !== undefined ? stats.totalAssignments : 0}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span>Student Satisfaction</span>
                </div>
                <span className="font-semibold text-slate-400">Coming soon</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
