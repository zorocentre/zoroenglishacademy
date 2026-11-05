import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Video, Calendar, Clock, CheckCircle, XCircle, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, BookOpen, Users } from 'lucide-react';
import { getOnlineSessionHistory } from '../../api/scheduleApi';
import { getTrainers } from '../../api/userApi';
import PageLoader from '../common/PageLoader';

function formatDuration(minutes, joined) {
  if (!joined || !minutes || minutes <= 0) {
    return '0m (Not Joined)';
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m (Joined)`;
  if (h > 0) return `${h}h (Joined)`;
  return `${m}m (Joined)`;
}

export default function AdminOnlineSessionHistoryPage() {
  const [schedules, setSchedules] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedTrainer, setSelectedTrainer] = useState('all');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const loadTrainers = useCallback(async () => {
    try {
      const res = await getTrainers();
      if (res?.success && Array.isArray(res.data)) {
        setTrainers(res.data);
      }
    } catch (err) {
      console.error('Failed to load trainers:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getOnlineSessionHistory({
        trainerId: selectedTrainer,
        fromDate,
        toDate
      });
      if (res?.success && Array.isArray(res.data)) {
        setSchedules(res.data);
      } else {
        setSchedules([]);
        if (res?.message) setError(res.message);
      }
    } catch (err) {
      console.error('Failed to fetch session history:', err);
      setError(err?.message || 'Failed to load online session history');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTrainer, fromDate, toDate]);

  useEffect(() => {
    loadTrainers();
  }, [loadTrainers]);

  useEffect(() => {
    loadData();
    setCurrentPage(1);
  }, [loadData]);

  // Client-side text filter (course, batch, trainer name)
  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) return schedules;
    const q = searchQuery.toLowerCase().trim();
    return schedules.filter(s =>
      (s.course && s.course.toLowerCase().includes(q)) ||
      (s.batch && s.batch.toLowerCase().includes(q)) ||
      (s.trainer && s.trainer.toLowerCase().includes(q)) ||
      (s.title && s.title.toLowerCase().includes(q))
    );
  }, [schedules, searchQuery]);

  // Summary Metrics calculated from the filtered date range results
  const summary = useMemo(() => {
    const total = filteredSchedules.length;
    let joined = 0;
    let notJoined = 0;
    let totalMinutes = 0;

    filteredSchedules.forEach(s => {
      const isJoined = Boolean(s.trainerJoined);
      if (isJoined) {
        joined++;
        totalMinutes += (s.creditedDurationMinutes || 0);
      } else {
        notJoined++;
      }
    });

    const hours = (totalMinutes / 60).toFixed(1);
    const fullHours = Math.floor(totalMinutes / 60);
    const remMins = totalMinutes % 60;
    const hoursLabel = fullHours > 0 || remMins > 0 ? `${fullHours}h ${remMins}m (${hours} hrs)` : '0.0 hrs';

    return {
      total,
      joined,
      notJoined,
      totalHours: hoursLabel
    };
  }, [filteredSchedules]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredSchedules.length / pageSize) || 1;
  const paginatedSchedules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSchedules.slice(start, start + pageSize);
  }, [filteredSchedules, currentPage, pageSize]);

  if (loading) {
    return <PageLoader fullPage message="Loading session history..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Online Session History</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Central audit log of all scheduled online sessions, trainer join status, and credited working hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Scheduled</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{summary.total}</span>
            <span className="text-xs text-slate-500 font-semibold">sessions</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600">Joined Sessions</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{summary.joined}</span>
            <span className="text-xs text-slate-500 font-semibold">credited</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600">Not Joined</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700">{summary.notJoined}</span>
            <span className="text-xs text-slate-500 font-semibold">uncredited</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-600">Total Credited Hours</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-800">{summary.totalHours.split(' ')[0]}</span>
            <span className="text-xs text-purple-600 font-bold">{summary.totalHours.replace(/^.*?(\(.*\))$/, '$1')}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        {/* Trainer Selector */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Trainer</label>
          <select
            value={selectedTrainer}
            onChange={(e) => setSelectedTrainer(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Trainers</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.email}
              </option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div className="w-full sm:w-auto">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* To Date */}
        <div className="w-full sm:w-auto">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Text Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Quick Search</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter course, batch, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Reset */}
        <div className="self-end pb-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectedTrainer('all');
              const d = new Date();
              d.setDate(1);
              setFromDate(d.toISOString().split('T')[0]);
              setToDate(new Date().toISOString().split('T')[0]);
              setSearchQuery('');
            }}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <PageLoader message="Loading online session history..." />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-xs font-bold text-rose-600">{error}</p>
            <button
              onClick={loadData}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
            >
              Retry
            </button>
          </div>
        ) : paginatedSchedules.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800">No session records found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no online sessions matching the selected trainer and date range.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold bg-slate-50/50">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Trainer</th>
                  <th className="py-3.5 px-4">Batch</th>
                  <th className="py-3.5 px-4">Course</th>
                  <th className="py-3.5 px-4">Scheduled Time</th>
                  <th className="py-3.5 px-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {paginatedSchedules.map((item) => {
                  const isJoined = Boolean(item.trainerJoined);
                  const durationLabel = formatDuration(item.creditedDurationMinutes, isJoined);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.date}
                      </td>

                      {/* Trainer */}
                      <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
                        {item.trainer || 'Unassigned'}
                      </td>

                      {/* Batch */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{item.batch || 'All Batches'}</span>
                        </span>
                      </td>

                      {/* Course */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{item.course}</span>
                        </span>
                      </td>

                      {/* Scheduled Time */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {item.time || (item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : 'N/A')}
                      </td>

                      {/* Duration & Join Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${
                            isJoined
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isJoined ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{durationLabel}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredSchedules.length > pageSize && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredSchedules.length)} of {filteredSchedules.length} records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 font-bold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
