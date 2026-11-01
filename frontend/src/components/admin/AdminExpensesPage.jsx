import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Search, Edit, Trash2, Calendar, Download, TrendingUp, TrendingDown, DollarSign, Filter, X, ArrowLeft, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../api/expenseApi';
import { getFeeRecords } from '../../api/feesApi';
import { getCompetitionRegistrations } from '../../api/competitionRegistrationApi';
import { exportToExcel } from '../../utils/excelExporter';
import ConfirmModal from '../common/ConfirmModal';
import MoneyInput from '../common/MoneyInput';
import { useDialog } from '../../context/DialogContext';

// Salary is EXCLUDED from manual expense categories because trainer salary is fetched automatically from Trainer Salary Management
const MANUAL_EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Internet',
  'Utilities',
  'Equipment',
  'Software',
  'Marketing',
  'Maintenance',
  'Travel',
  'Training Materials',
  'Other'
];

const ALL_FILTER_CATEGORIES = ['All', 'Salary', ...MANUAL_EXPENSE_CATEGORIES];

export default function AdminExpensesPage({ setActiveScreen }) {
  const { showSuccess, showError } = useDialog();
  const [expenses, setExpenses] = useState([]);
  const [feeRecords, setFeeRecords] = useState([]);
  const [compRegistrations, setCompRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeFinancialTab, setActiveFinancialTab] = useState('expenses'); // 'expenses' | 'revenue'
  const [selectedRevenueSource, setSelectedRevenueSource] = useState('All'); // 'All' | 'Student Fees' | 'Competition Registration'

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Date Range Filtering
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteExpenseData, setDeleteExpenseData] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Utilities',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'UPI / Online',
    paidTo: '',
    referenceNo: '',
    notes: ''
  });

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    setLoading(true);
    const expRes = await getExpenses();
    setExpenses(expRes.data || []);

    const feesRes = await getFeeRecords();
    setFeeRecords(feesRes.data || []);

    const compRegRes = await getCompetitionRegistrations();
    setCompRegistrations(compRegRes.data || []);

    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'Utilities',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'UPI / Online',
      paidTo: '',
      referenceNo: '',
      notes: ''
    });
    setEditingExpense(null);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.amount) return;

    try {
      let res;
      if (editingExpense) {
        res = await updateExpense(editingExpense.id, formData);
      } else {
        res = await createExpense(formData);
      }

      if (res && res.success) {
        resetForm();
        setShowAddModal(false);
        await showSuccess(res.message || (editingExpense ? 'Expense updated successfully' : 'Expense recorded successfully'), editingExpense ? 'Expense Saved' : 'Expense Recorded');
        loadFinancialData();
      } else {
        await showError(res?.message || (editingExpense ? 'Failed to update expense' : 'Failed to record expense'), 'Save Failed');
      }
    } catch (err) {
      await showError(err?.message || 'Failed to save expense', 'Save Failed');
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteExpenseData) {
      try {
        const res = await deleteExpense(deleteExpenseData.id);
        setDeleteExpenseData(null);
        if (res && res.success) {
          await showSuccess(res.message || 'Expense deleted successfully', 'Expense Deleted');
          loadFinancialData();
        } else {
          await showError(res?.message || 'Failed to delete expense', 'Delete Failed');
        }
      } catch (err) {
        setDeleteExpenseData(null);
        await showError(err?.message || 'Failed to delete expense', 'Delete Failed');
      }
    }
  };

  const openEditModal = (exp) => {
    if (exp.isAutoSalary) return; // Prevent editing auto salary expense
    setEditingExpense(exp);
    setFormData({
      title: exp.title || '',
      category: exp.category && exp.category !== 'Salary' ? exp.category : 'Utilities',
      description: exp.description || '',
      amount: exp.amount || '',
      date: exp.date || new Date().toISOString().split('T')[0],
      paymentMethod: exp.paymentMethod || 'UPI / Online',
      paidTo: exp.paidTo || '',
      referenceNo: exp.referenceNo || '',
      notes: exp.notes || ''
    });
    setShowAddModal(true);
  };

  const handleExportExcel = () => {
    const headers = ['Date', 'Expense Title', 'Category', 'Description', 'Amount (₹)', 'Paid To', 'Payment Method', 'Reference No', 'Source', 'Notes'];
    const rows = filteredExpenses.map(e => [
      e.date || '',
      e.title || '',
      e.category || '',
      e.description || '',
      e.amount || 0,
      e.paidTo || '',
      e.paymentMethod || '',
      e.referenceNo || '',
      e.source || (e.isAutoSalary ? 'Trainer Salary' : 'Manual Expense'),
      e.notes || ''
    ]);
    exportToExcel(`Zoro_Academy_Expenses_${new Date().toISOString().split('T')[0]}.xlsx`, 'Expenses', headers, rows);
  };

  const isDateFiltered = Boolean(fromDate || toDate);

  const filteredFeeRecords = feeRecords.filter(f => {
    if (!f.date) return true;
    if (fromDate && f.date < fromDate) return false;
    if (toDate && f.date > toDate) return false;
    return true;
  });

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.paidTo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.source || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || e.category === selectedCategory;

    let matchesDate = true;
    if (fromDate && e.date < fromDate) matchesDate = false;
    if (toDate && e.date > toDate) matchesDate = false;

    return matchesSearch && matchesCategory && matchesDate;
  });

  // Financial Summary Formulas
  const totalStudentFeeIncome = filteredFeeRecords.reduce((sum, f) => sum + (parseFloat(f.paidAmount) || 0), 0);
  const totalCompIncome = compRegistrations
    .filter(r => (r.paymentStatus === 'Paid' || r.paymentStatus === 'PAID'))
    .filter(r => {
      if (!fromDate && !toDate) return true;
      const d = (r.paidAt || r.paymentDate || r.registrationDate || '').split('T')[0].split(' ')[0];
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    })
    .reduce((sum, r) => {
      const amt = r.amount != null ? Number(r.amount) : (r.amountPaise != null ? Number(r.amountPaise) / 100 : Number(r.registrationFee || 0));
      return sum + amt;
    }, 0);

  const totalIncome = totalStudentFeeIncome + totalCompIncome;
  const totalExpense = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const netBalance = totalIncome - totalExpense;

  // Revenue Log Items (Requirement #10)
  const studentFeeItems = filteredFeeRecords.map(f => ({
    id: `fee_${f.id || f.studentId}_${f.date || 'rec'}`,
    date: f.date || f.paymentDate || '2026-09-20',
    title: f.courseName || 'Student Course Fee',
    participant: f.studentName || f.name || 'Enrolled Student',
    source: 'Student Fees',
    amount: parseFloat(f.paidAmount || f.amount || 0),
    paymentStatus: f.status || 'Paid',
    referenceNo: f.receiptNo || f.referenceNo || 'FEE_RECEIPT'
  }));

  const compRevenueItems = compRegistrations
    .filter(r => (r.paymentStatus === 'Paid' || r.paymentStatus === 'PAID'))
    .map(r => ({
      id: `comp_${r.id}`,
      date: (r.paidAt || r.paymentDate || r.registrationDate || '').split('T')[0].split(' ')[0] || '2026-09-20',
      title: r.competitionName || 'Competition Registration',
      participant: r.studentName || 'Participant',
      source: 'Competition Registration',
      amount: r.amount != null ? Number(r.amount) : (r.amountPaise != null ? Number(r.amountPaise) / 100 : Number(r.registrationFee || 0)),
      paymentStatus: 'Paid',
      referenceNo: r.razorpayPaymentId || r.razorpayOrderId || 'RAZORPAY_PAID'
    }));

  const allRevenueItems = [...studentFeeItems, ...compRevenueItems].filter(item => {
    const matchesSearch = !searchTerm || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.participant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.referenceNo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSource = selectedRevenueSource === 'All' || item.source === selectedRevenueSource;

    let matchesDate = true;
    if (fromDate && item.date < fromDate) matchesDate = false;
    if (toDate && item.date > toDate) matchesDate = false;

    return matchesSearch && matchesSource && matchesDate;
  });

  // Expense breakdown by category
  const categoryBreakdown = {};
  filteredExpenses.forEach(exp => {
    const cat = exp.category || 'Other';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (parseFloat(exp.amount) || 0);
  });

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Back Button & Header */}
      {setActiveScreen && (
        <button 
          onClick={() => setActiveScreen('admin-dash')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Admin Dashboard</span>
        </button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Academy Financial Management Portal</h1>
          <p className="text-xs text-slate-500 font-medium">Complete financial overview: Total Revenue (Student Fees + Competition Registrations), Expenses, and Net Balance.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportExcel}
            className="bg-slate-800 hover:bg-slate-900 text-white font-extrabold px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-2 text-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Financial Excel</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="bg-[#0F52BA] hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md flex items-center space-x-2 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manual Expense</span>
          </button>
        </div>
      </div>

      {/* DATE-BASED FINANCIAL FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs w-full sm:w-auto">
          <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-blue-600" />
            Financial Date Period Filter:
          </span>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="mt-4 px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg font-bold text-[10px] hover:bg-rose-200 cursor-pointer"
            >
              Clear Date Filter
            </button>
          )}
        </div>

        {isDateFiltered && (
          <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            {fromDate === toDate ? `Single-Day Report: ${fromDate}` : `Showing Period: ${fromDate || 'Start'} to ${toDate || 'Today'}`}
          </div>
        )}
      </div>

      {/* FINANCIAL SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total Revenue Card (Requirement #5) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md border-l-8 border-l-emerald-500 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>TOTAL REVENUE</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp className="w-5 h-5" /></span>
          </div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight">₹{totalIncome.toLocaleString()}</div>
          <p className="text-[11px] font-bold text-emerald-700">
            Student Fees: ₹{totalStudentFeeIncome.toLocaleString()} • Competitions: ₹{totalCompIncome.toLocaleString()}
          </p>
        </div>

        {/* Total Expense Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md border-l-8 border-l-rose-500 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>TOTAL EXPENSES</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown className="w-5 h-5" /></span>
          </div>
          <div className="text-3xl font-black text-rose-600 tracking-tight">₹{totalExpense.toLocaleString()}</div>
          <p className="text-[11px] font-bold text-rose-700">📉 Automatic Trainer Salary + Manual Expenses</p>
        </div>

        {/* Net Balance Card */}
        <div className={`bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md border-l-8 space-y-2 ${netBalance >= 0 ? 'border-l-blue-600' : 'border-l-amber-600'}`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>NET BALANCE</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Wallet className="w-5 h-5" /></span>
          </div>
          <div className={`text-3xl font-black tracking-tight ${netBalance >= 0 ? 'text-blue-900' : 'text-amber-600'}`}>
            ₹{netBalance.toLocaleString()}
          </div>
          <p className="text-[11px] font-bold text-slate-500">Formula: Net = Total Revenue - Total Expenses</p>
        </div>

      </div>

      {/* FINANCIAL BREAKDOWN CARD (Requirement #9) */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-6">
        <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          Financial Breakdown & Revenue Sources
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start text-xs">
          
          {/* Income Side */}
          <div className="space-y-3 bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100">
            <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">Student Revenue Sources</h4>
            
            <div className="space-y-2 font-bold">
              <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-emerald-200">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  Student Course Fees
                </span>
                <span className="text-emerald-700 font-black">₹{totalStudentFeeIncome.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-emerald-200">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  Competition Registrations
                </span>
                <span className="text-emerald-700 font-black">₹{totalCompIncome.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-emerald-200 font-black text-sm text-emerald-900">
              <span>Total Revenue</span>
              <span>₹{totalIncome.toLocaleString()}</span>
            </div>
          </div>

          {/* Expense Side */}
          <div className="space-y-3 bg-rose-50/40 p-5 rounded-2xl border border-rose-100">
            <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider">Expense Categories Breakdown</h4>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {Object.keys(categoryBreakdown).length === 0 ? (
                <div className="text-slate-400 font-bold italic p-2">No expenses logged yet.</div>
              ) : (
                Object.entries(categoryBreakdown).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-rose-100 font-bold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      {cat === 'Salary' ? <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span> : <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>}
                      {cat} {cat === 'Salary' && <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-bold">(Auto)</span>}
                    </span>
                    <span className="text-rose-700 font-black">₹{amt.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-rose-200 font-black text-sm text-rose-900">
              <span>Total Expenses</span>
              <span>₹{totalExpense.toLocaleString()}</span>
            </div>
          </div>

        </div>
      </div>

      {/* FINANCIAL TRANSACTIONS TABLE SECTION (Requirement #10) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden space-y-4 p-6 sm:p-8">
        
        {/* Tab Headers: Expenses Log vs Revenue Log */}
        <div className="flex border-b border-slate-200 gap-6 text-xs font-extrabold pb-1">
          <button
            onClick={() => setActiveFinancialTab('expenses')}
            className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeFinancialTab === 'expenses'
                ? 'border-rose-600 text-rose-700 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>Expenses & Salaries Log ({filteredExpenses.length})</span>
          </button>

          <button
            onClick={() => setActiveFinancialTab('revenue')}
            className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeFinancialTab === 'revenue'
                ? 'border-emerald-600 text-emerald-700 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>Revenue & Income Log ({allRevenueItems.length})</span>
          </button>
        </div>

        {/* Table Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeFinancialTab === 'expenses' ? "🔍 Search expenses by title, vendor, category..." : "🔍 Search revenue by participant, title, reference #..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white"
            />
          </div>

          {activeFinancialTab === 'expenses' ? (
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-bold text-slate-500">Expense Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                {ALL_FILTER_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-bold text-slate-500">Revenue Source:</span>
              <select
                value={selectedRevenueSource}
                onChange={(e) => setSelectedRevenueSource(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="All">All Revenue Sources</option>
                <option value="Student Fees">Student Course Fees</option>
                <option value="Competition Registration">Competition Registrations</option>
              </select>
            </div>
          )}
        </div>

        {/* TAB 1: EXPENSES LOG TABLE */}
        {activeFinancialTab === 'expenses' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Expense Title</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Amount (₹)</th>
                  <th className="py-3.5 px-4">Paid To / Vendor</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Reference #</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="py-8 text-center text-slate-400 font-bold whitespace-normal">
                      Loading expenses...
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-8 text-center text-slate-400 font-bold whitespace-normal">
                      No expense records found.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-500">{exp.date}</td>
                      <td className="py-4 px-4 font-black text-slate-900">{exp.title}</td>
                      <td className="py-4 px-4 font-bold">
                        <span className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                          exp.category === 'Salary'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-500 max-w-xs truncate">{exp.description || '-'}</td>
                      <td className="py-4 px-4 font-black text-rose-600 font-mono text-sm">₹{(parseFloat(exp.amount) || 0).toLocaleString()}</td>
                      <td className="py-4 px-4 font-bold text-slate-800">{exp.paidTo || '-'}</td>
                      <td className="py-4 px-4 font-semibold text-slate-600">{exp.paymentMethod || 'Online'}</td>
                      <td className="py-4 px-4 font-mono text-slate-400">{exp.referenceNo || '-'}</td>
                      <td className="py-4 px-4 font-bold">
                        {exp.isAutoSalary || exp.source === 'Trainer Salary' ? (
                          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                            <ShieldCheck className="w-3 h-3 text-purple-600" />
                            Trainer Salary
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            Manual Expense
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        {exp.isAutoSalary ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200" title="Managed automatically in Salary Management">
                            Auto (Salary Mgmt)
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => openEditModal(exp)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="Edit Manual Expense"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteExpenseData(exp)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete Manual Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: REVENUE / INCOME LOG TABLE (Requirement #10) */}
        {activeFinancialTab === 'revenue' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Participant / Student</th>
                  <th className="py-3.5 px-4">Revenue Source</th>
                  <th className="py-3.5 px-4">Program / Competition</th>
                  <th className="py-3.5 px-4">Amount (₹)</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  <th className="py-3.5 px-4">Reference # / Razorpay ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {allRevenueItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400 font-bold whitespace-normal">
                      No revenue transactions found for selected filters.
                    </td>
                  </tr>
                ) : (
                  allRevenueItems.map((rev) => (
                    <tr key={rev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-500">{rev.date}</td>
                      <td className="py-4 px-4 font-black text-slate-900">{rev.participant}</td>
                      <td className="py-4 px-4 font-bold">
                        <span className={`px-2.5 py-1 rounded-lg border text-[11px] ${
                          rev.source === 'Competition Registration'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        }`}>
                          {rev.source}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-extrabold text-slate-800">{rev.title}</td>
                      <td className="py-4 px-4 font-black text-emerald-600 font-mono text-sm">₹{rev.amount.toLocaleString()}</td>
                      <td className="py-4 px-4 font-bold">
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                          {rev.paymentStatus}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500">{rev.referenceNo}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Add / Edit Manual Expense Modal (Salary Category Excluded) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 text-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4 max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black text-slate-900">
              {editingExpense ? `Edit Manual Expense: ${editingExpense.title}` : 'Record New Manual Expense'}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Note: Trainer salary payments are automatically fetched from Trainer Salary Management and cannot be created here.
            </p>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expense Title / Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Internet Bill"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  >
                    {MANUAL_EXPENSE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <MoneyInput
                    required
                    placeholder="e.g. 2500"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Paid To / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. ABC Internet Services"
                    value={formData.paidTo}
                    onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                  >
                    <option value="UPI / Online">UPI / Online</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reference / Invoice Number</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-091"
                  value={formData.referenceNo}
                  onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Short description of the expense..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-md text-xs cursor-pointer"
              >
                {editingExpense ? 'Update Expense' : 'Save Manual Expense Record'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteExpenseData)}
        onClose={() => setDeleteExpenseData(null)}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete Manual Expense"
        message={`Are you sure you want to delete manual expense record "${deleteExpenseData?.title}"?`}
        confirmText="Delete Expense"
        cancelText="Cancel"
      />

    </div>
  );
}

