import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Wallet, Plus, Search, Calendar, RefreshCw, Eye, Trash2, 
  CheckCircle2, Clock, Users, BookOpen, AlertCircle, X, ChevronLeft, ChevronRight, FileText, ArrowUpDown
} from 'lucide-react';
import { getSalaryPayments, createSalaryPayment, deleteSalaryPayment, getPaymentSessions } from '../../api/salaryApi';
import { getUnpaidCreditedSessions } from '../../api/scheduleApi';
import { getTrainers } from '../../api/userApi';
import { useDialog } from '../../context/DialogContext';
import PageLoader from '../common/PageLoader';

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function AdminSalaryPage() {
  const { showConfirm, showAlert } = useDialog();

  const [salaries, setSalaries] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedTrainerFilter, setSelectedTrainerFilter] = useState('all');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Add Salary Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addFormError, setAddFormError] = useState('');

  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [selectedTrainerName, setSelectedTrainerName] = useState('');
  const [periodFromDate, setPeriodFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [periodToDate, setPeriodToDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Eligible sessions preview for Add Salary
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [eligibleSessions, setEligibleSessions] = useState([]);
  const [showSessionPreview, setShowSessionPreview] = useState(true);

  // Salary breakdown
  const [onlineSalary, setOnlineSalary] = useState('');
  const [recordedSalary, setRecordedSalary] = useState('');

  // Payment details
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  // View Sessions Modal state
  const [viewModalPayment, setViewModalPayment] = useState(null);
  const [viewSessionsList, setViewSessionsList] = useState([]);
  const [loadingViewSessions, setLoadingViewSessions] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [salRes, trnRes] = await Promise.all([
        getSalaryPayments(),
        getTrainers()
      ]);
      if (salRes?.success && Array.isArray(salRes.data)) {
        setSalaries(salRes.data);
      } else {
        setSalaries([]);
        if (salRes?.message) setError(salRes.message);
      }
      if (trnRes?.success && Array.isArray(trnRes.data)) {
        setTrainers(trnRes.data);
      }
    } catch (err) {
      console.error('Failed to load salary page data:', err);
      setError(err?.message || 'Failed to load salary payment records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch eligible credited sessions whenever trainer or period changes in Add Modal
  const fetchEligibleSessions = useCallback(async (tId, fromD, toD) => {
    if (!tId || !fromD || !toD || fromD > toD) {
      setEligibleSessions([]);
      return;
    }
    setLoadingEligible(true);
    try {
      const res = await getUnpaidCreditedSessions({
        trainerId: tId,
        fromDate: fromD,
        toDate: toD
      });
      if (res?.success && Array.isArray(res.data)) {
        setEligibleSessions(res.data);
      } else {
        setEligibleSessions([]);
      }
    } catch (err) {
      console.error('Failed to load unpaid credited sessions:', err);
      setEligibleSessions([]);
    } finally {
      setLoadingEligible(false);
    }
  }, []);

  useEffect(() => {
    if (isAddModalOpen && selectedTrainer && periodFromDate && periodToDate) {
      fetchEligibleSessions(selectedTrainer, periodFromDate, periodToDate);
    }
  }, [isAddModalOpen, selectedTrainer, periodFromDate, periodToDate, fetchEligibleSessions]);

  // Filtered salary records
  const filteredSalaries = useMemo(() => {
    return salaries.filter(s => {
      // Trainer filter
      if (selectedTrainerFilter !== 'all') {
        const matchTrainer = s.trainerId === selectedTrainerFilter ||
          (s.trainerName && s.trainerName.toLowerCase() === selectedTrainerFilter.toLowerCase());
        if (!matchTrainer) return false;
      }
      // Date range filter on paymentDate
      if (filterFromDate && s.paymentDate && s.paymentDate < filterFromDate) {
        return false;
      }
      if (filterToDate && s.paymentDate && s.paymentDate > filterToDate) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery = (
          (s.trainerName && s.trainerName.toLowerCase().includes(q)) ||
          (s.transactionId && s.transactionId.toLowerCase().includes(q)) ||
          (s.reference && s.reference.toLowerCase().includes(q)) ||
          (s.paymentMethod && s.paymentMethod.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
        );
        if (!matchesQuery) return false;
      }
      return true;
    });
  }, [salaries, selectedTrainerFilter, filterFromDate, filterToDate, searchQuery]);

  // Payment totals for summary cards
  const summaryTotals = useMemo(() => {
    let totalPaid = 0;
    let totalOnline = 0;
    let totalRecorded = 0;

    filteredSalaries.forEach(s => {
      totalPaid += (parseFloat(s.totalSalary || s.amount) || 0);
      totalOnline += (parseFloat(s.onlineSessionSalary) || 0);
      totalRecorded += (parseFloat(s.recordedSessionSalary) || 0);
    });

    return {
      totalPaid,
      totalOnline,
      totalRecorded,
      count: filteredSalaries.length
    };
  }, [filteredSalaries]);

  // Pagination
  const totalPages = Math.ceil(filteredSalaries.length / pageSize) || 1;
  const paginatedSalaries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSalaries.slice(start, start + pageSize);
  }, [filteredSalaries, currentPage, pageSize]);

  // Handle Add Salary Modal Open
  const handleOpenAddModal = () => {
    setAddFormError('');
    setIsSubmitting(false);
    const defaultTrainer = trainers[0]?.id || '';
    const defaultTrainerName = trainers[0]?.name || '';
    setSelectedTrainer(defaultTrainer);
    setSelectedTrainerName(defaultTrainerName);
    const d = new Date();
    d.setDate(1);
    const fromD = d.toISOString().split('T')[0];
    const toD = new Date().toISOString().split('T')[0];
    setPeriodFromDate(fromD);
    setPeriodToDate(toD);
    setOnlineSalary('');
    setRecordedSalary('');
    setPaymentMethod('Bank Transfer');
    setTransactionId('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setIsAddModalOpen(true);
    if (defaultTrainer) {
      fetchEligibleSessions(defaultTrainer, fromD, toD);
    }
  };

  // Add Salary Form Submit
  const handleAddSalarySubmit = async (e) => {
    e.preventDefault();
    setAddFormError('');

    if (!selectedTrainer) {
      setAddFormError('Please select a trainer');
      return;
    }
    if (!periodFromDate || !periodToDate) {
      setAddFormError('Please select both From Date and To Date for the salary period');
      return;
    }
    if (periodFromDate > periodToDate) {
      setAddFormError('From Date cannot be later than To Date');
      return;
    }
    if (!paymentDate) {
      setAddFormError('Please specify the Date of Payment');
      return;
    }
    if (!paymentMethod) {
      setAddFormError('Please choose a payment method');
      return;
    }

    const online = parseFloat(onlineSalary || 0);
    const recorded = parseFloat(recordedSalary || 0);

    if (isNaN(online) || online < 0) {
      setAddFormError('Online Session Salary must be a valid non-negative number');
      return;
    }
    if (isNaN(recorded) || recorded < 0) {
      setAddFormError('Recorded Session Salary must be a valid non-negative number');
      return;
    }

    const total = online + recorded;
    if (total <= 0) {
      setAddFormError('Total Salary must be greater than zero. Please enter either Online or Recorded session salary.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        trainerId: selectedTrainer,
        trainerName: selectedTrainerName,
        fromDate: periodFromDate,
        toDate: periodToDate,
        onlineSessionSalary: online,
        recordedSessionSalary: recorded,
        totalSalary: total,
        amount: total,
        paymentMethod,
        transactionId: transactionId.trim(),
        paymentDate,
        notes: paymentNotes.trim()
      };

      const res = await createSalaryPayment(payload);
      if (res?.success) {
        setIsAddModalOpen(false);
        await showAlert({
          title: 'Salary Recorded',
          message: `Successfully recorded payment of ₹${total.toLocaleString()} for ${selectedTrainerName || 'trainer'}.`
        });
        loadData();
      } else {
        setAddFormError(res?.message || 'Failed to record salary payment');
      }
    } catch (err) {
      console.error('Failed to submit salary payment:', err);
      setAddFormError(err?.message || 'Failed to submit salary payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Salary Record
  const handleDeleteSalary = async (salary) => {
    const confirmed = await showConfirm({
      title: 'Delete Salary Record',
      message: `Are you sure you want to delete the salary payment of ₹${parseFloat(salary.totalSalary || salary.amount || 0).toLocaleString()} for ${salary.trainerName}? Covered online sessions will be unlinked and eligible for future payments.`
    });
    if (!confirmed) return;

    try {
      const res = await deleteSalaryPayment(salary.id);
      if (res?.success) {
        setSalaries(prev => prev.filter(s => s.id !== salary.id));
        await showAlert({
          title: 'Record Deleted',
          message: 'Salary payment record was successfully deleted.'
        });
      } else {
        await showAlert({
          title: 'Error',
          message: res?.message || 'Failed to delete salary record.'
        });
      }
    } catch (err) {
      console.error('Failed to delete salary record:', err);
      await showAlert({
        title: 'Error',
        message: err?.message || 'Failed to delete salary record.'
      });
    }
  };

  // Handle View Sessions Modal
  const handleOpenViewSessions = async (salary) => {
    setViewModalPayment(salary);
    setLoadingViewSessions(true);
    setViewSessionsList([]);
    try {
      const res = await getPaymentSessions(salary.id);
      if (res?.success && Array.isArray(res.data)) {
        setViewSessionsList(res.data);
      } else {
        setViewSessionsList([]);
      }
    } catch (err) {
      console.error('Failed to load payment sessions:', err);
      setViewSessionsList([]);
    } finally {
      setLoadingViewSessions(false);
    }
  };

  // Eligible sessions totals in Add modal
  const eligibleTotals = useMemo(() => {
    const count = eligibleSessions.length;
    let mins = 0;
    eligibleSessions.forEach(s => {
      mins += (s.creditedDurationMinutes || 0);
    });
    const hours = (mins / 60).toFixed(1);
    const durationLabel = formatDuration(mins);
    return { count, mins, hours, durationLabel };
  }, [eligibleSessions]);

  const liveCalculatedTotal = useMemo(() => {
    const o = parseFloat(onlineSalary || 0) || 0;
    const r = parseFloat(recordedSalary || 0) || 0;
    return Math.max(0, o + r);
  }, [onlineSalary, recordedSalary]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trainer Salary</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Record manual salary disbursements based on verified online session working hours and recorded content
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
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/20 cursor-pointer transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Salary</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600">Total Salary Paid</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">₹{summaryTotals.totalPaid.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">Online Session Salary</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-700">₹{summaryTotals.totalOnline.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-600">Recorded Session Salary</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700">₹{summaryTotals.totalRecorded.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Payments</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{summaryTotals.count}</span>
            <span className="text-xs text-slate-500 font-semibold">records</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        {/* Trainer Selector */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Trainer</label>
          <select
            value={selectedTrainerFilter}
            onChange={(e) => setSelectedTrainerFilter(e.target.value)}
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
            value={filterFromDate}
            onChange={(e) => setFilterFromDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* To Date */}
        <div className="w-full sm:w-auto">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
          <input
            type="date"
            value={filterToDate}
            onChange={(e) => setFilterToDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Text Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search trainer, reference, notes..."
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
              setSelectedTrainerFilter('all');
              setFilterFromDate('');
              setFilterToDate('');
              setSearchQuery('');
            }}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Payment History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <PageLoader message="Loading salary payments..." />
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
        ) : paginatedSalaries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800">No salary payment records found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no salary payments recorded for the selected criteria. Click "Add Salary" to disburse a payment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold bg-slate-50/50">
                  <th className="py-3.5 px-4">Payment Date</th>
                  <th className="py-3.5 px-4">Trainer</th>
                  <th className="py-3.5 px-4">Salary Period</th>
                  <th className="py-3.5 px-4">Online Salary</th>
                  <th className="py-3.5 px-4">Recorded Salary</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Sessions / Hours</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {paginatedSalaries.map((item) => {
                  const total = parseFloat(item.totalSalary || item.amount || 0);
                  const online = parseFloat(item.onlineSessionSalary || 0);
                  const recorded = parseFloat(item.recordedSessionSalary || 0);
                  const period = (item.fromDate && item.toDate)
                    ? `${item.fromDate} to ${item.toDate}`
                    : (item.month || 'N/A');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Payment Date */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.paymentDate || item.date || 'N/A'}
                      </td>

                      {/* Trainer */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-black text-slate-900">{item.trainerName}</span>
                      </td>

                      {/* Period */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        {period}
                      </td>

                      {/* Online Salary */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-blue-700">
                        ₹{online.toLocaleString()}
                      </td>

                      {/* Recorded Salary */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-purple-700">
                        ₹{recorded.toLocaleString()}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-black text-emerald-700">
                        ₹{total.toLocaleString()}
                      </td>

                      {/* Payment Method & Ref */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{item.paymentMethod || item.method || 'Bank Transfer'}</span>
                          {item.transactionId ? (
                            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" title={item.transactionId}>
                              Ref: {item.transactionId}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Sessions & Hours */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {item.sessionCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            <span>{item.sessionCount} sessions</span>
                            <span>•</span>
                            <span>{item.creditedHours} hrs</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">None linked</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenViewSessions(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title="View Credited Sessions"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSalary(item)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title="Delete Salary Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredSalaries.length > pageSize && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredSalaries.length)} of {filteredSalaries.length} records
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

      {/* ======================================================== */}
      {/* ADD SALARY MODAL (PHASE 5)                                */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-base font-black text-slate-900">Record Trainer Salary Payment</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Select trainer, verify credited working hours, and enter salary details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSalarySubmit} className="p-6 space-y-5">
              {addFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addFormError}</span>
                </div>
              )}

              {/* 1. Trainer & Period */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Trainer & Salary Period</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Trainer *</label>
                    <select
                      value={selectedTrainer}
                      onChange={(e) => {
                        const tId = e.target.value;
                        setSelectedTrainer(tId);
                        const match = trainers.find(t => t.id === tId);
                        setSelectedTrainerName(match ? (match.name || match.email) : '');
                      }}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                    >
                      <option value="">Select Trainer</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name || t.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">From Date *</label>
                    <input
                      type="date"
                      value={periodFromDate}
                      onChange={(e) => setPeriodFromDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">To Date *</label>
                    <input
                      type="date"
                      value={periodToDate}
                      onChange={(e) => setPeriodToDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Credited Online Sessions Live Summary Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black text-slate-800">
                      Eligible Credited Online Sessions in Period
                    </span>
                  </div>
                  {loadingEligible ? (
                    <span className="text-xs text-blue-600 font-bold animate-pulse">Calculating...</span>
                  ) : (
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                      {eligibleTotals.count} sessions • {eligibleTotals.durationLabel} ({eligibleTotals.hours} hrs)
                    </span>
                  )}
                </div>

                {eligibleSessions.length > 0 ? (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-1">
                      <span>Sessions to be credited in this payment:</span>
                      <button
                        type="button"
                        onClick={() => setShowSessionPreview(!showSessionPreview)}
                        className="text-blue-600 hover:underline font-bold"
                      >
                        {showSessionPreview ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>

                    {showSessionPreview && (
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <th className="py-1.5 px-3">Date</th>
                              <th className="py-1.5 px-3">Course / Batch</th>
                              <th className="py-1.5 px-3">Time</th>
                              <th className="py-1.5 px-3 text-right">Credited</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {eligibleSessions.map(s => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="py-1 px-3 font-mono text-slate-700">{s.date}</td>
                                <td className="py-1 px-3 font-medium text-slate-800 truncate max-w-[160px]">
                                  {s.course} ({s.batch || 'All'})
                                </td>
                                <td className="py-1 px-3 text-slate-500 font-mono">{s.time}</td>
                                <td className="py-1 px-3 text-right font-bold text-emerald-600">
                                  {formatDuration(s.creditedDurationMinutes)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 font-medium">
                    {loadingEligible
                      ? 'Fetching trainer session records...'
                      : 'No unpaid credited sessions found in this date range. (You can still enter a recorded session salary or manual adjustment.)'}
                  </p>
                )}
              </div>

              {/* 2. Salary Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Salary Breakdown</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Online Session Salary (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 15000"
                      value={onlineSalary}
                      onChange={(e) => setOnlineSalary(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Recorded Session Salary (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 5000"
                      value={recordedSalary}
                      onChange={(e) => setRecordedSalary(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Auto Calculated Total Banner */}
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">
                    Total Salary (Auto-Calculated)
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    ₹{liveCalculatedTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 3. Payment Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Payment Details</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method *</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Txn ID</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR / Ref No"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date of Payment *</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                  <textarea
                    rows="2"
                    placeholder="Optional remarks or disbursement memo..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || liveCalculatedTotal <= 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Record Payment (₹{liveCalculatedTotal.toLocaleString()})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW SESSIONS MODAL (PHASE 6 AUDIT INSPECTION)           */}
      {/* ======================================================== */}
      {viewModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Credited Sessions for Payment
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Trainer: <span className="text-slate-800 font-bold">{viewModalPayment.trainerName}</span> • Period: <span className="font-mono">{viewModalPayment.fromDate || viewModalPayment.month} to {viewModalPayment.toDate || ''}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewModalPayment(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Amount</span>
                  <span className="text-sm font-black text-emerald-700">
                    ₹{parseFloat(viewModalPayment.totalSalary || viewModalPayment.amount || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Linked Sessions</span>
                  <span className="text-sm font-black text-slate-800">
                    {viewSessionsList.length || viewModalPayment.sessionCount || 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Credited Hours</span>
                  <span className="text-sm font-black text-blue-700">
                    {viewModalPayment.creditedHours || 0} hrs
                  </span>
                </div>
              </div>

              {loadingViewSessions ? (
                <div className="p-8 text-center">
                  <PageLoader message="Loading associated session records..." />
                </div>
              ) : viewSessionsList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-semibold">
                  No individual online session schedules are linked to this payment record (disbursed as recorded/manual payment).
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Course</th>
                        <th className="py-2.5 px-3">Batch</th>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3 text-right">Credited Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {viewSessionsList.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{s.date}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{s.course}</td>
                          <td className="py-2.5 px-3 text-slate-600">{s.batch || 'All'}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{s.time}</td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                            {formatDuration(s.creditedDurationMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setViewModalPayment(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
