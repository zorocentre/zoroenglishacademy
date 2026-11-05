import React, { useState, useEffect } from 'react';
import { 
  Users, Activity, BookOpen, TrendingUp, Clock, DollarSign, Wallet, TrendingDown, UserCheck
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiGet } from '../../api/client';
import { getTrainerCourseRequests } from '../../api/courseApi';
import PageLoader from '../common/PageLoader';

export default function AdminDashboard({ setActiveScreen }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    studentCount: 0,
    totalStudents: 0,
    trainerCount: 0,
    courseCount: 0,
    batchCount: 0,
    totalIncome: 0,
    studentFeeIncome: 0,
    competitionIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    attendancePresent: 0,
    attendanceTotal: 0,
    attendanceRate: 0,
    monthlyAdmissions: [
      { month: 'Jan', count: 0 },
      { month: 'Feb', count: 0 },
      { month: 'Mar', count: 0 },
      { month: 'Apr', count: 0 },
      { month: 'May', count: 0 },
      { month: 'Jun', count: 0 },
      { month: 'Jul', count: 0 },
      { month: 'Aug', count: 0 },
      { month: 'Sep', count: 0 }
    ],
    monthlyCollections: [
      { month: 'Jan', amount: 0 },
      { month: 'Feb', amount: 0 },
      { month: 'Mar', amount: 0 },
      { month: 'Apr', amount: 0 },
      { month: 'May', amount: 0 },
      { month: 'Jun', amount: 0 },
      { month: 'Jul', amount: 0 },
      { month: 'Aug', amount: 0 },
      { month: 'Sep', amount: 0 }
    ]
  });

  const [pendingTrainerRequests, setPendingTrainerRequests] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [dashRes, trReqRes] = await Promise.all([
          apiGet('/admin/dashboard'),
          getTrainerCourseRequests()
        ]);

        if (trReqRes?.data) {
          const pending = trReqRes.data.filter(r => r.status === 'Pending');
          setPendingTrainerRequests(pending);
        }

        if (dashRes?.success && dashRes.data) {
          const d = dashRes.data;
          setMetrics({
            studentCount: d.studentCount || 0,
            totalStudents: d.totalStudents ?? d.studentCount ?? 0,
            trainerCount: d.trainerCount || 0,
            courseCount: d.courseCount || 0,
            batchCount: d.batchCount || 0,
            totalIncome: parseFloat(d.totalIncome || 0),
            studentFeeIncome: parseFloat(d.studentFeeIncome || 0),
            competitionIncome: parseFloat(d.competitionIncome || 0),
            totalExpenses: parseFloat(d.totalExpenses || 0),
            netBalance: parseFloat(d.netBalance || 0),
            attendancePresent: d.attendancePresent || 0,
            attendanceTotal: d.attendanceTotal || 0,
            attendanceRate: d.attendanceRate || 0,
            monthlyAdmissions: (d.monthlyAdmissions || []).map(a => ({
              month: a.month,
              count: a.students || 0
            })),
            monthlyCollections: (d.monthlyCollections || []).map(c => ({
              month: c.month,
              amount: parseFloat(c.price || c.amount || c.fees || 0)
            }))
          });
        }
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <PageLoader fullPage message="Loading admin dashboard..." />;
  }

  const {
    studentCount,
    totalStudents,
    courseCount,
    totalIncome,
    studentFeeIncome,
    competitionIncome,
    totalExpenses,
    netBalance,
    attendancePresent,
    attendanceTotal,
    attendanceRate,
    monthlyAdmissions,
    monthlyCollections
  } = metrics;

  const topNonFinancialStats = [
    { title: 'Total Students', value: `${totalStudents} Students`, icon: Users, color: 'border-l-4 border-teal-500 bg-teal-50/50 text-teal-700', desc: 'Total students registered in the system' },
    { title: 'Active Enrolled Students', value: studentCount, icon: Users, color: 'border-l-4 border-blue-600 bg-blue-50/50 text-blue-700', desc: 'Total registered academy students' },
    { title: 'Daily Attendance Rate', value: `${attendancePresent} / ${attendanceTotal} (${attendanceRate}%)`, icon: Clock, color: 'border-l-4 border-amber-500 bg-amber-50/50 text-amber-700', desc: 'Verified session attendance' },
    { title: 'Published Courses', value: `${courseCount} Active Courses`, icon: BookOpen, color: 'border-l-4 border-sky-500 bg-sky-50/50 text-sky-800', desc: 'Available course programs' },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-8 bg-slate-50 min-h-screen">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Portal Dashboard</h1>
          <p className="text-xs text-slate-500 font-medium">Real-time academy performance metrics, consolidated financial overview, and student analytics from PostgreSQL database.</p>
        </div>
      </div>

      {/* PENDING TRAINER COURSE ENQUIRY ALERT BANNER */}
      {pendingTrainerRequests.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 p-5 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white font-black flex items-center justify-center shadow-sm shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full uppercase">
                New Trainer Course Enquiry ({pendingTrainerRequests.length} Pending)
              </span>
              <h3 className="text-base font-black text-purple-950 mt-0.5">
                Trainer: {pendingTrainerRequests[0].trainerName} • Course: {pendingTrainerRequests[0].courseTitle}
              </h3>
              <p className="text-xs text-purple-700 font-semibold">
                Status: Pending Admin Review and Approval
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveScreen && setActiveScreen('admin-enquiries')}
            className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md cursor-pointer shrink-0 transition-colors"
          >
            View Enquiry
          </button>
        </div>
      )}

      {/* TOP NON-FINANCIAL STATISTICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {topNonFinancialStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 ${stat.color} transition-all hover:shadow-md space-y-2`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-500">{stat.title}</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/80 shadow-xs">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[10px] font-semibold text-slate-400">{stat.desc}</p>
            </div>
          );
        })}
      </div>

      {/* EXPENSES FINANCIAL SUMMARY BOX */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Wallet className="w-6 h-6 text-blue-600" />
              FINANCIAL OVERVIEW
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Consolidated financial metrics dynamically calculated from Student Fees, Trainer Salary Management, and Manual Expenses.
            </p>
          </div>
          <span className="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 self-start sm:self-auto">
            Live Database Sync
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          
          {/* Total Income */}
          <div className="p-5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">Total Income</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-1">₹{totalIncome.toLocaleString()}</div>
            <p className="text-[10px] text-emerald-700 font-semibold">
              Student Fees: ₹{studentFeeIncome.toLocaleString()} • Competitions: ₹{competitionIncome.toLocaleString()}
            </p>
          </div>

          {/* Total Expenses */}
          <div className="p-5 bg-rose-50/70 rounded-2xl border border-rose-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">Total Expenses</span>
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-900 mt-1">₹{totalExpenses.toLocaleString()}</div>
            <p className="text-[10px] text-rose-700 font-semibold">Includes Paid Trainer Salaries + Manual Expenses</p>
          </div>

          {/* Net Balance */}
          <div className={`p-5 rounded-2xl border space-y-1 ${netBalance >= 0 ? 'bg-blue-50/70 border-blue-200' : 'bg-amber-50/70 border-amber-300'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-extrabold uppercase tracking-wider ${netBalance >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>Net Balance</span>
              <Wallet className={`w-4 h-4 ${netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
            </div>
            <div className={`text-2xl font-black mt-1 ${netBalance >= 0 ? 'text-blue-900' : 'text-amber-900'}`}>
              {netBalance < 0 ? `-₹${Math.abs(netBalance).toLocaleString()}` : `₹${netBalance.toLocaleString()}`}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">Formula: Total Income - Total Expenses</p>
          </div>

        </div>
      </div>

      {/* DASHBOARD GRAPHS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Graph 1: New Admissions */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>New Admissions Trend</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Monthly breakdown of student registrations.</p>
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">Database Aggregates</span>
          </div>
          <div className="h-64 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAdmissions} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(val) => [`${val} Students`, 'Admissions']}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Fee Revenue & Collections */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Fee Collections Trend</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Monthly student fee collection analytics.</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Live Total: ₹{totalIncome.toLocaleString()}
            </span>
          </div>
          <div className="h-64 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCollections} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(val) => [`₹${val ? Number(val).toLocaleString() : 0}`, 'Fee Collection']}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
