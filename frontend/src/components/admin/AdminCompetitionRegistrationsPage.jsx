import React, { useState, useEffect } from 'react';
import { 
  Trophy, Search, Filter, Calendar, Users, DollarSign, 
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Layers, ShieldCheck, Download, Eye, EyeOff, Copy, Check, Key, X, Edit 
} from 'lucide-react';
import { 
  getCompetitionRegistrations, 
  updateRegistrationStatus, 
  updateCompetitionRegistration,
  getRegistrationCredential,
  resetRegistrationPassword
} from '../../api/competitionRegistrationApi';
import { getCompetitions } from '../../api/competitionApi';
import ConfirmModal from '../common/ConfirmModal';

export default function AdminCompetitionRegistrationsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompFilter, setSelectedCompFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  const [viewingReg, setViewingReg] = useState(null);
  const [cancelModalReg, setCancelModalReg] = useState(null);
  const [editingPaymentReg, setEditingPaymentReg] = useState(null);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [resetModalReg, setResetModalReg] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resettingLoading, setResettingLoading] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    razorpayOrderId: '',
    razorpayPaymentId: '',
    amount: '',
    paymentStatus: 'PAID'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const regRes = await getCompetitionRegistrations();
      setRegistrations(regRes.data || []);

      const compRes = await getCompetitions();
      setCompetitions(compRes.data || []);
    } catch (err) {
      console.error('Failed to load competition registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirmCancelReg = async () => {
    if (cancelModalReg) {
      await updateRegistrationStatus(cancelModalReg.id, 'Cancelled', cancelModalReg.paymentStatus);
      setCancelModalReg(null);
      loadData();
    }
  };

  const handleOpenEditPayment = (reg) => {
    setEditingPaymentReg(reg);
    const amt = reg.amount != null ? reg.amount : (reg.amountPaise != null ? reg.amountPaise / 100 : (reg.registrationFee || '0'));
    setPaymentForm({
      razorpayOrderId: reg.razorpayOrderId || '',
      razorpayPaymentId: reg.razorpayPaymentId || '',
      amount: String(amt),
      paymentStatus: reg.paymentStatus || 'PAID'
    });
  };

  const handleSavePaymentEdit = async (e) => {
    e.preventDefault();
    if (!editingPaymentReg) return;
    try {
      const payload = {
        razorpayOrderId: paymentForm.razorpayOrderId.trim() || null,
        razorpayPaymentId: paymentForm.razorpayPaymentId.trim() || null,
        amount: paymentForm.amount ? Number(paymentForm.amount) : 0,
        paymentStatus: paymentForm.paymentStatus
      };
      await updateCompetitionRegistration(editingPaymentReg.id, payload);
      setEditingPaymentReg(null);
      loadData();
    } catch (err) {
      console.error('Failed to update registration payment details:', err);
    }
  };

  const handleTogglePassword = async (regId) => {
    const existing = revealedPasswords[regId];
    if (existing && !existing.loading) {
      setRevealedPasswords(prev => ({
        ...prev,
        [regId]: { ...existing, hidden: !existing.hidden }
      }));
      return;
    }

    setRevealedPasswords(prev => ({
      ...prev,
      [regId]: { loading: true }
    }));

    try {
      const res = await getRegistrationCredential(regId);
      if (res && res.success && res.data) {
        setRevealedPasswords(prev => ({
          ...prev,
          [regId]: {
            loading: false,
            hidden: false,
            password: res.data.password || '',
            hasPassword: Boolean(res.data.hasPassword),
            source: res.data.source || 'STORED',
            message: res.data.message || ''
          }
        }));
      } else {
        setRevealedPasswords(prev => ({
          ...prev,
          [regId]: { loading: false, error: true, message: 'Failed to fetch' }
        }));
      }
    } catch (e) {
      setRevealedPasswords(prev => ({
        ...prev,
        [regId]: { loading: false, error: true, message: 'Error' }
      }));
    }
  };

  const handleCopyPassword = (regId, pwd) => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedId(regId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExecuteResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalReg) return;
    setResettingLoading(true);
    setResetSuccessMsg('');
    try {
      const res = await resetRegistrationPassword(resetModalReg.id, resetNewPassword.trim() || null);
      if (res && res.success && res.data) {
        const newPwd = res.data.password;
        setRevealedPasswords(prev => ({
          ...prev,
          [resetModalReg.id]: {
            loading: false,
            hidden: false,
            password: newPwd,
            hasPassword: true,
            source: 'STORED'
          }
        }));
        setResetSuccessMsg(`Password successfully set to: ${newPwd}`);
        setTimeout(() => {
          setResetModalReg(null);
          setResetNewPassword('');
          setResetSuccessMsg('');
        }, 2500);
      }
    } catch (err) {
      console.error('Failed to reset password:', err);
    } finally {
      setResettingLoading(false);
    }
  };

  const filteredRegistrations = registrations.filter(r => {
    const matchesSearch = !searchTerm || (
      r.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.studentEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.competitionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.batchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.razorpayPaymentId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesComp = selectedCompFilter === 'All' || r.competitionName === selectedCompFilter || r.competitionId === selectedCompFilter;
    const matchesStatus = selectedStatusFilter === 'All' || r.paymentStatus === selectedStatusFilter || r.registrationStatus === selectedStatusFilter;

    return matchesSearch && matchesComp && matchesStatus;
  });

  // Calculate Revenue Stats - Count only PAID & SUCCESS registrations
  const paidRegistrations = registrations.filter(r => 
    (r.paymentStatus === 'Paid' || r.paymentStatus === 'PAID' || r.paymentStatus === 'SUCCESS') && 
    r.registrationStatus !== 'Cancelled'
  );
  const totalRevenue = paidRegistrations.reduce((sum, r) => {
    const amt = r.amount != null ? Number(r.amount) : (r.amountPaise != null ? Number(r.amountPaise) / 100 : Number(r.registrationFee || 0));
    return sum + amt;
  }, 0);
  const totalRegCount = paidRegistrations.length;

  // Group by Competition Name -> Array of Participants
  const groupedByCompetition = filteredRegistrations.reduce((acc, reg) => {
    const compKey = reg.competitionName || 'General Competition';

    if (!acc[compKey]) {
      acc[compKey] = [];
    }
    acc[compKey].push(reg);
    return acc;
  }, {});

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-amber-500" />
            <span>Competition Registrations & Revenue</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Track participant registrations, online Razorpay transactions, and competition revenue.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Total Registrations</div>
          <div className="text-3xl font-black text-slate-900 mt-1">{totalRegCount} Participants</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-emerald-600 font-semibold">Total Competition Revenue</div>
          <div className="text-3xl font-black text-emerald-600 mt-1">₹{totalRevenue.toLocaleString()}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-blue-600 font-semibold">Verified Online Payments</div>
          <div className="text-3xl font-black text-blue-600 mt-1">{paidRegistrations.length} Paid</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search registrations by participant, email, phone, competition, payment ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <select
              value={selectedCompFilter}
              onChange={(e) => setSelectedCompFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
            >
              <option value="All">All Competitions</option>
              {competitions.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
            >
              <option value="All">All Payment Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Competition-wise Grouped Registrations Display */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs font-bold text-slate-400">
          Loading competition registrations...
        </div>
      ) : Object.keys(groupedByCompetition).length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
          <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">No competition registrations found</h3>
          <p className="text-xs text-slate-400">Registered participants will appear here automatically grouped by competition.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByCompetition).map(([compName, studentList]) => (
            <div key={compName} className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden space-y-4">
              
              {/* Competition Group Header */}
              <div className="bg-slate-900 text-white p-5 px-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">{compName}</h2>
                    <span className="text-slate-400 text-xs font-medium">
                      {studentList.length} Registered Participants
                    </span>
                  </div>
                </div>
              </div>

              {/* Table of Registered Students with Horizontal Scroll (Section 5) */}
              <div className="p-6 pt-2 overflow-x-auto">
                <div className="border border-slate-200 rounded-2xl overflow-hidden min-w-[1100px]">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4 sticky left-0 z-10 bg-slate-50 border-r border-slate-200 shadow-xs">Participant Name</th>
                        <th className="py-3 px-4">Email & Phone</th>
                        <th className="py-3 px-4">Password</th>
                        <th className="py-3 px-4">Age / School / City</th>
                        <th className="py-3 px-4">Reg Date</th>
                        <th className="py-3 px-4">Amount (₹)</th>
                        <th className="py-3 px-4">Payment Status</th>
                        <th className="py-3 px-4">Razorpay Order ID</th>
                        <th className="py-3 px-4">Razorpay Payment ID</th>
                        <th className="py-3 px-4">Reg Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {studentList.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="py-3.5 px-4 font-black text-slate-900 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-xs">
                            {student.studentName}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{student.studentEmail}</div>
                            <div className="text-[11px] text-slate-400">{student.studentPhone}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            {(() => {
                              const isPaid = student.paymentStatus === 'SUCCESS' || student.paymentStatus === 'PAID' || student.paymentStatus === 'Paid';
                              if (!isPaid) {
                                return (
                                  <span className="text-[11px] text-slate-400 italic font-semibold">Available on payment</span>
                                );
                              }
                              const rev = revealedPasswords[student.id];
                              if (!rev || rev.hidden) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePassword(student.id)}
                                    disabled={rev?.loading}
                                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold cursor-pointer transition"
                                    title="Click to reveal participant password"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                                    <span>{rev?.loading ? 'Fetching...' : '••••••••'}</span>
                                  </button>
                                );
                              }

                              if (!rev.hasPassword) {
                                return (
                                  <div className="inline-flex items-center space-x-2">
                                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold italic">
                                      Set by admin
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setResetModalReg(student)}
                                      className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                <div className="inline-flex items-center space-x-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5">
                                  <span className="font-mono font-bold text-slate-900 text-xs">
                                    {rev.password}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPassword(student.id, rev.password)}
                                    className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                    title="Copy Password"
                                  >
                                    {copiedId === student.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePassword(student.id)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                    title="Hide Password"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setResetModalReg(student)}
                                    className="p-1 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                                    title="Reset Password"
                                  >
                                    <Key className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-4 text-[11px]">
                            {student.age || student.school || student.city ? (
                              <div className="space-y-0.5">
                                {student.age && <span className="font-bold text-slate-800">Age: {student.age} </span>}
                                {student.school && <div className="text-slate-500">{student.school}</div>}
                                {student.city && <div className="text-slate-400">{student.city}</div>}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-700">
                            {student.registrationDate}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-slate-900">
                            ₹{(student.amount != null ? Number(student.amount) : (student.amountPaise != null ? student.amountPaise / 100 : Number(student.registrationFee ?? 0))).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black ${
                              student.paymentStatus === 'Paid' || student.paymentStatus === 'PAID' || student.paymentStatus === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : student.paymentStatus === 'PENDING_PAYMENT' || student.paymentStatus === 'Pending' || student.paymentStatus === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {student.paymentStatus === 'Paid' || student.paymentStatus === 'PAID' || student.paymentStatus === 'SUCCESS'
                                ? 'SUCCESS'
                                : student.paymentStatus === 'PENDING_PAYMENT' || student.paymentStatus === 'Pending' || student.paymentStatus === 'PENDING'
                                ? 'PENDING'
                                : 'FAILED'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 font-bold">
                            {student.razorpayOrderId || '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 font-bold">
                            {student.razorpayPaymentId || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              student.registrationStatus === 'Registered'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {student.registrationStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => setViewingReg(student)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditPayment(student)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                              title="Edit Payment / Order Details"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {student.registrationStatus !== 'Cancelled' && (
                              <button
                                onClick={() => setCancelModalReg(student)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Cancel Registration"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}


      {/* VIEW REGISTRATION DETAILS MODAL */}
      {viewingReg && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 text-xs">
            <button
              onClick={() => setViewingReg(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-slate-900">Registration Details</h3>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-slate-700 font-semibold">
              <div><strong>Student Name:</strong> {viewingReg.studentName}</div>
              <div><strong>Email:</strong> {viewingReg.studentEmail}</div>
              <div><strong>Phone:</strong> {viewingReg.studentPhone}</div>
              <div className="flex items-center space-x-2 pt-1 border-t border-slate-200">
                <strong>Password:</strong>
                {(() => {
                  const rev = revealedPasswords[viewingReg.id];
                  if (!rev || rev.hidden) {
                    return (
                      <button
                        type="button"
                        onClick={() => handleTogglePassword(viewingReg.id)}
                        disabled={rev?.loading}
                        className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[11px] font-bold cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>{rev?.loading ? 'Fetching...' : 'Show Password'}</span>
                      </button>
                    );
                  }
                  if (!rev.hasPassword) {
                    return (
                      <div className="inline-flex items-center space-x-2">
                        <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold italic">
                          Set by admin
                        </span>
                        <button
                          type="button"
                          onClick={() => setResetModalReg(viewingReg)}
                          className="text-[11px] text-blue-600 hover:underline font-bold cursor-pointer"
                        >
                          Reset Password
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="inline-flex items-center space-x-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                      <span className="font-mono font-bold text-slate-900 text-xs">{rev.password}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyPassword(viewingReg.id, rev.password)}
                        className="p-1 text-slate-500 hover:text-blue-600 cursor-pointer"
                        title="Copy"
                      >
                        {copiedId === viewingReg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePassword(viewingReg.id)}
                        className="p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                        title="Hide"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetModalReg(viewingReg)}
                        className="p-1 text-slate-500 hover:text-amber-600 cursor-pointer"
                        title="Reset"
                      >
                        <Key className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })()}
              </div>
              <div><strong>Competition:</strong> {viewingReg.competitionName}</div>
              <div><strong>Batch:</strong> {viewingReg.batchName}</div>
              <div><strong>Registration Date:</strong> {viewingReg.registrationDate}</div>
              <div><strong>Amount:</strong> ₹{(viewingReg.amount != null ? Number(viewingReg.amount) : (viewingReg.amountPaise != null ? viewingReg.amountPaise / 100 : viewingReg.registrationFee || 0)).toFixed(2)}</div>
              <div><strong>Payment Status:</strong> <span className="font-bold text-emerald-700">{viewingReg.paymentStatus}</span></div>
              <div><strong>Razorpay Order ID:</strong> <span className="font-mono text-xs">{viewingReg.razorpayOrderId || 'None'}</span></div>
              <div><strong>Razorpay Payment ID:</strong> <span className="font-mono text-xs">{viewingReg.razorpayPaymentId || 'None'}</span></div>
              <div><strong>Payment Date/Time:</strong> {viewingReg.paidAt || viewingReg.paymentDate || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PAYMENT DETAILS MODAL */}
      {editingPaymentReg && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 text-xs">
            <button
              onClick={() => setEditingPaymentReg(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-slate-900">Update Payment Details</h3>
            <p className="text-slate-500 text-xs">
              Participant: <strong className="text-slate-800">{editingPaymentReg.studentName}</strong> ({editingPaymentReg.studentEmail})
            </p>

            <form onSubmit={handleSavePaymentEdit} className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Razorpay Order ID</label>
                <input
                  type="text"
                  placeholder="e.g. order_To9BmBYSQ6tIeC"
                  value={paymentForm.razorpayOrderId}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, razorpayOrderId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Razorpay Payment ID</label>
                <input
                  type="text"
                  placeholder="e.g. pay_To9CWFbE5lG2sO"
                  value={paymentForm.razorpayPaymentId}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, razorpayPaymentId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Status</label>
                <select
                  value={paymentForm.paymentStatus}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                >
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="PENDING">PENDING</option>
                  <option value="FAILED">FAILED</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPaymentReg(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Payment Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL REGISTRATION MODAL */}
      <ConfirmModal
        isOpen={Boolean(cancelModalReg)}
        onClose={() => setCancelModalReg(null)}
        onConfirm={handleConfirmCancelReg}
        title="Cancel Competition Registration"
        message={`Are you sure you want to cancel ${cancelModalReg?.studentName}'s registration for "${cancelModalReg?.competitionName}"?`}
        confirmText="Cancel Registration"
        cancelText="Keep Active"
      />

      {/* RESET REGISTRATION PASSWORD MODAL */}
      {resetModalReg && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 text-xs animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setResetModalReg(null);
                setResetNewPassword('');
                setResetSuccessMsg('');
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 text-amber-600">
              <Key className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-black text-slate-900">Reset Password</h3>
            </div>

            <p className="text-slate-600 text-xs">
              Participant: <strong className="text-slate-900">{resetModalReg.studentName}</strong> ({resetModalReg.studentEmail})
            </p>

            {resetSuccessMsg ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{resetSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleExecuteResetPassword} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    New Password (Optional, leave blank to auto-generate 10-char secure password)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave blank to auto-generate"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setResetModalReg(null);
                      setResetNewPassword('');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resettingLoading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{resettingLoading ? 'Resetting...' : 'Set & Encrypt Password'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
