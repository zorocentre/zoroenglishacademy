import React, { useState, useEffect } from 'react';
import { Search, Eye, Edit2, X } from 'lucide-react';
import { getSalaryPayments, createSalaryPayment, updateSalaryPayment, getSalaryStats } from '../../api/salaryApi';
import { getTrainers } from '../../api/userApi';
import { useDialog } from '../../context/DialogContext';

function parseDueDay(creditDateStr) {
  if (!creditDateStr) return 25;
  const match = String(creditDateStr).match(/\d+/);
  if (match) {
    const day = parseInt(match[0], 10);
    return isNaN(day) || day < 1 || day > 31 ? 25 : day;
  }
  return 25;
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function computeTrainerSalaryRow(trainer, allSalaries, today = new Date()) {
  const dueDay = parseDueDay(trainer.salaryCreditDate);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  const currentDay = today.getDate();

  const maxDayThisMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const effectiveDueDayThisMonth = Math.min(dueDay, maxDayThisMonth);

  // Is today on or past the due day of this month?
  const isPastDueThisMonth = currentDay >= effectiveDueDayThisMonth;

  let targetYear = currentYear;
  let targetMonth = currentMonth;

  if (!isPastDueThisMonth) {
    // Check if the previous month's cycle is paid
    const prevDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthName = prevDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const prevPaid = (allSalaries || []).some(s =>
      (s.trainerId === trainer.id || (s.trainerName && s.trainerName.toLowerCase() === trainer.name?.toLowerCase())) &&
      s.month?.toLowerCase() === prevMonthName.toLowerCase() &&
      s.status === 'Paid'
    );

    if (!prevPaid) {
      // Previous month is unpaid -> focus on previous month's overdue cycle
      targetYear = prevDate.getFullYear();
      targetMonth = prevDate.getMonth();
    }
  }

  const targetDate = new Date(targetYear, targetMonth, 1);
  const cycleMonthName = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const maxDayInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetEffectiveDueDay = Math.min(dueDay, maxDayInTargetMonth);
  const targetDueDate = new Date(targetYear, targetMonth, targetEffectiveDueDay);

  // Find payment record for this cycle
  const paymentRecord = (allSalaries || []).find(s =>
    (s.trainerId === trainer.id || (s.trainerName && s.trainerName.toLowerCase() === trainer.name?.toLowerCase())) &&
    s.month?.toLowerCase() === cycleMonthName.toLowerCase() &&
    s.status === 'Paid'
  );

  let status;
  if (paymentRecord) {
    status = 'PAID';
  } else {
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const dueMidnight = new Date(targetDueDate.getFullYear(), targetDueDate.getMonth(), targetDueDate.getDate()).getTime();

    if (todayMidnight === dueMidnight) {
      status = 'DUE TODAY';
    } else if (todayMidnight > dueMidnight) {
      status = 'OVERDUE';
    } else {
      status = 'PENDING';
    }
  }

  const amount = parseFloat(trainer.salaryAmount || 25000);

  return {
    id: trainer.id,
    trainerId: trainer.id,
    trainerName: trainer.name,
    specialty: trainer.specialty || 'Trainer',
    month: cycleMonthName,
    cycleMonthName,
    amount: amount,
    dueDay: targetEffectiveDueDay,
    dueDateFormatted: `${getOrdinal(targetEffectiveDueDay)} of every month`,
    status: status,
    paymentRecord: paymentRecord,
    lastPaymentDate: paymentRecord ? (paymentRecord.paymentDate || paymentRecord.date || 'Paid') : 'Not paid yet'
  };
}

export default function AdminSalaryPage() {
  const { showSuccess, showError } = useDialog();
  const [salaries, setSalaries] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [stats, setStats] = useState({ totalPaid: 0, currentMonthPaid: 0, uniqueTrainersPaid: 0, totalRecords: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);

  const [formData, setFormData] = useState({
    trainerId: '',
    trainerName: '',
    salaryAmount: '',
    salaryDueDayText: '',
    month: '',
    date: new Date().toISOString().split('T')[0],
    method: 'Bank Transfer',
    reference: '',
    notes: ''
  });

  const loadData = async () => {
    const salRes = await getSalaryPayments();
    setSalaries(salRes.data || []);

    const trnRes = await getTrainers();
    setTrainers(trnRes.data || []);

    const statRes = await getSalaryStats();
    setStats(statRes.data || {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const openRecordModal = (item) => {
    setFormData({
      trainerId: item.id,
      trainerName: item.trainerName,
      salaryAmount: item.amount,
      salaryDueDayText: item.dueDateFormatted,
      month: item.cycleMonthName,
      date: new Date().toISOString().split('T')[0],
      method: 'Bank Transfer',
      reference: '',
      notes: ''
    });
    setEditingRecord(null);
    setShowAddModal(true);
  };

  const openEditModal = (item) => {
    const rec = item.paymentRecord || {};
    setEditingRecord(rec.id ? rec : { id: `sal_edit_${item.id}`, ...item });
    setFormData({
      trainerId: item.id,
      trainerName: item.trainerName,
      salaryAmount: item.amount,
      salaryDueDayText: item.dueDateFormatted,
      month: rec.month || item.cycleMonthName,
      date: rec.paymentDate || rec.date || new Date().toISOString().split('T')[0],
      method: rec.method || rec.paymentMethod || 'Bank Transfer',
      reference: rec.reference || rec.transactionId || '',
      notes: rec.notes || ''
    });
    setShowAddModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.trainerId || !formData.trainerName) return;
    try {
      const res = await createSalaryPayment({
        trainerId: formData.trainerId,
        trainerName: formData.trainerName,
        month: formData.month,
        amount: parseFloat(formData.salaryAmount || 0),
        date: formData.date,
        method: formData.method,
        reference: formData.reference,
        notes: formData.notes,
        status: 'Paid'
      });
      if (res && res.success) {
        setShowAddModal(false);
        await showSuccess(res.message || 'Salary payment recorded successfully', 'Payment Recorded');
        loadData();
      } else {
        await showError(res?.message || 'Failed to record salary payment', 'Payment Error');
      }
    } catch (err) {
      await showError(err?.message || 'Failed to record salary payment', 'Payment Error');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    try {
      const res = await updateSalaryPayment(editingRecord.id, {
        trainerId: formData.trainerId,
        trainerName: formData.trainerName,
        month: formData.month,
        amount: parseFloat(formData.salaryAmount || 0),
        date: formData.date,
        method: formData.method,
        reference: formData.reference,
        notes: formData.notes,
        status: 'Paid'
      });
      if (res && res.success) {
        setEditingRecord(null);
        setShowAddModal(false);
        await showSuccess(res.message || 'Salary record updated successfully', 'Salary Updated');
        loadData();
      } else {
        await showError(res?.message || 'Failed to update salary payment', 'Update Error');
      }
    } catch (err) {
      await showError(err?.message || 'Failed to update salary payment', 'Update Error');
    }
  };

  // Compute dynamic trainer salary status for each trainer in Manage Trainers (1-to-1 sync)
  const computedTrainerSalaries = (trainers || []).map(trn => {
    return computeTrainerSalaryRow(trn, salaries);
  });

  // Sort priority: 1. DUE TODAY, 2. OVERDUE, 3. PENDING, 4. PAID
  const statusPriority = {
    'DUE TODAY': 1,
    'OVERDUE': 2,
    'PENDING': 3,
    'PAID': 4
  };

  const sortedSalaries = [...computedTrainerSalaries].sort((a, b) => {
    const prioA = statusPriority[a.status] || 5;
    const prioB = statusPriority[b.status] || 5;
    if (prioA !== prioB) return prioA - prioB;
    return a.trainerName.localeCompare(b.trainerName);
  });

  const filteredSalaries = sortedSalaries.filter(item => {
    const query = (searchTerm || '').toLowerCase().trim();
    const matchesSearch = !query || 
      item.trainerName.toLowerCase().includes(query) || 
      item.specialty.toLowerCase().includes(query);
    
    const matchesStatus = selectedStatus === 'All' || 
      (selectedStatus === 'Paid' && item.status === 'PAID') ||
      (selectedStatus === 'Pending' && (item.status === 'PENDING' || item.status === 'DUE TODAY')) ||
      (selectedStatus === 'Overdue' && item.status === 'OVERDUE');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header - Top-right Record button removed as each row has its own action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Trainer Salary Management</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Track monthly salary disbursements, cycle-based payment status, and record disbursements for trainers.</p>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Total Salary Paid</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">₹{(stats?.totalPaid || 0).toLocaleString()}</div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1">{stats?.totalRecords || 0} Disbursed Records</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Current Month Salary</div>
          <div className="text-2xl font-black text-[#0F52BA] mt-1">₹{(stats?.currentMonthPaid || 0).toLocaleString()}</div>
          <div className="text-[10px] text-[#0F52BA] font-bold mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Trainers with Dues</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {computedTrainerSalaries.filter(s => s.status !== 'PAID').length}
          </div>
          <div className="text-[10px] text-amber-700 font-bold mt-1">Cycle dues pending</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Trainers Paid</div>
          <div className="text-2xl font-black text-purple-600 mt-1">{computedTrainerSalaries.filter(s => s.status === 'PAID').length} of {trainers.length}</div>
          <div className="text-[10px] text-purple-700 font-bold mt-1">Active Trainers</div>
        </div>
      </div>

      {/* Search & Status Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between gap-3 items-center">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
          >
            <option value="All">All Salary Statuses</option>
            <option value="Paid">PAID</option>
            <option value="Pending">PENDING</option>
            <option value="Overdue">OVERDUE</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search trainer or specialty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Salary Status & Disbursements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Trainer Name</th>
                <th className="py-3.5 px-4">Specialty</th>
                <th className="py-3.5 px-4">Monthly Salary</th>
                <th className="py-3.5 px-4">Salary Due Date</th>
                <th className="py-3.5 px-4">Payment Status</th>
                <th className="py-3.5 px-4">Last Payment</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredSalaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                    No trainer salary records found matching search or status criteria.
                  </td>
                </tr>
              ) : (
                filteredSalaries.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`transition-colors ${
                      item.status === 'DUE TODAY' 
                        ? 'bg-amber-50/60 hover:bg-amber-50' 
                        : item.status === 'OVERDUE'
                        ? 'bg-rose-50/40 hover:bg-rose-50/80'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-4 px-4 font-black text-slate-900">{item.trainerName}</td>
                    <td className="py-4 px-4 text-slate-600 font-medium">{item.specialty}</td>
                    <td className="py-4 px-4 font-black text-emerald-600">₹{item.amount.toLocaleString()}</td>
                    <td className="py-4 px-4 font-bold text-slate-700">{item.dueDateFormatted}</td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        item.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : item.status === 'DUE TODAY'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                          : item.status === 'OVERDUE'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">{item.lastPaymentDate}</td>
                    <td className="py-4 px-4 text-right space-x-1.5">
                      {item.status !== 'PAID' && (
                        <button
                          onClick={() => openRecordModal(item)}
                          className="bg-[#0F52BA] hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (item.paymentRecord) {
                            setViewingRecord(item.paymentRecord);
                          } else {
                            setViewingRecord({
                              trainerName: item.trainerName,
                              month: item.month,
                              amount: item.amount,
                              date: 'Pending',
                              method: 'Bank Transfer',
                              notes: 'Salary due for current cycle'
                            });
                          }
                        }}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {item.paymentRecord && (
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Payment Record"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record / Edit Salary Modal */}
      {(showAddModal || editingRecord) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 text-xs max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => { setShowAddModal(false); setEditingRecord(null); }}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-slate-900">
              {editingRecord ? 'Edit Salary Payment' : 'Record Salary Payment'}
            </h3>

            <form onSubmit={editingRecord ? handleUpdate : handleCreate} className="space-y-3 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Trainer (Pre-filled)</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={formData.trainerName}
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Configured Salary</label>
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-black text-emerald-600">
                    ₹{Number(formData.salaryAmount || 0).toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Due Day</label>
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700">
                    {formData.salaryDueDayText}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Salary Month</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. October 2026"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Transaction ID / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. TXN98421054"
                  value={formData.reference || ''}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Performance bonus included or bank remarks"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0F52BA] hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-md transition-colors text-xs mt-3 cursor-pointer"
              >
                {editingRecord ? 'Save Changes' : 'Confirm & Save Salary Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 text-xs max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setViewingRecord(null)}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-slate-900">Salary Payment Receipt</h3>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 font-medium">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Trainer Name:</span>
                <span className="font-bold text-slate-900">{viewingRecord.trainerName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Salary Month:</span>
                <span className="font-bold text-slate-900">{viewingRecord.month}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Amount:</span>
                <span className="font-black text-emerald-600 text-sm">₹{parseFloat(viewingRecord.amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Payment Date:</span>
                <span className="font-mono text-slate-800">{viewingRecord.paymentDate || viewingRecord.date || 'Pending'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-800">{viewingRecord.paymentMethod || viewingRecord.method || 'Bank Transfer'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono text-slate-800">{viewingRecord.transactionId || viewingRecord.reference || 'None'}</span>
              </div>
              {viewingRecord.notes && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Notes:</span>
                  <span className="text-slate-800 italic">{viewingRecord.notes}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setViewingRecord(null)}
              className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
