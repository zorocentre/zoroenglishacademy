import React, { useState, useEffect } from 'react';
import { Edit, Trash2, X, Plus, Search, Calendar, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2, Copy, Check, Key, Eye, EyeOff, BookOpen } from 'lucide-react';
import { getTrainers, createTrainer, updateTrainer, deleteTrainer, updateUserStatus, getTrainerDependencies, getTrainerDeletionImpact, replaceTrainer, getAdminVisiblePassword, setAdminUserPassword } from '../../api/userApi';
import { getTrainerCourseAccessList, revokeTrainerCourseAccess } from '../../api/courseApi';
import { logActivity } from '../../api/activityLogApi';
import { sanitizePhone, validatePhone, formatPhone, SUBMIT_PHONE_ERROR } from '../../utils/phoneValidator';
import ConfirmModal from '../common/ConfirmModal';
import MoneyInput from '../common/MoneyInput';
import PhoneInput from '../common/PhoneInput';
import { useDialog } from '../../context/DialogContext';

export default function ManageTrainersPage() {
  const { showSuccess, showError, showWarning } = useDialog();
  const [trainers, setTrainers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [joinedDate, setJoinedDate] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [deleteTrainerData, setDeleteTrainerData] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [formError, setFormError] = useState('');
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [createdTrainerModalData, setCreatedTrainerModalData] = useState(null);
  const [trainerDepModalData, setTrainerDepModalData] = useState(null);

  // Admin password states
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [loadingPasswordId, setLoadingPasswordId] = useState(null);
  const [copiedTrainerPasswordId, setCopiedTrainerPasswordId] = useState(null);
  const [passwordModalTrainer, setPasswordModalTrainer] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordModalError, setPasswordModalError] = useState('');
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);

  // Trainer Enrolled Courses states
  const [showEnrolledCoursesModal, setShowEnrolledCoursesModal] = useState(false);
  const [enrolledCoursesList, setEnrolledCoursesList] = useState([]);
  const [loadingEnrolledCourses, setLoadingEnrolledCourses] = useState(false);
  const [enrolledCourseSearch, setEnrolledCourseSearch] = useState('');
  const [enrolledCourseModeFilter, setEnrolledCourseModeFilter] = useState('ALL');
  const [enrolledCourseTrainerFilter, setEnrolledCourseTrainerFilter] = useState('ALL');
  const [revokeConfirmData, setRevokeConfirmData] = useState(null);
  const [revokingAccess, setRevokingAccess] = useState(false);

  const loadEnrolledCourses = async () => {
    setLoadingEnrolledCourses(true);
    try {
      const res = await getTrainerCourseAccessList();
      if (res && res.success && Array.isArray(res.data)) {
        setEnrolledCoursesList(res.data);
      } else {
        setEnrolledCoursesList([]);
      }
    } catch (err) {
      console.error('Failed to load trainer course access list:', err);
      setEnrolledCoursesList([]);
    } finally {
      setLoadingEnrolledCourses(false);
    }
  };

  const handleConfirmRevokeAccess = async () => {
    if (!revokeConfirmData) return;
    setRevokingAccess(true);
    try {
      const res = await revokeTrainerCourseAccess(revokeConfirmData.trainerId, revokeConfirmData.courseId);
      if (res && res.success) {
        showSuccess(`Access revoked for ${revokeConfirmData.trainerName || 'trainer'} on course ${revokeConfirmData.courseTitle || ''}`, 'Access Revoked');
        setRevokeConfirmData(null);
        await loadEnrolledCourses();
      } else {
        showError(res?.message || 'Failed to revoke access', 'Error');
      }
    } catch (err) {
      showError(err?.message || 'Failed to revoke access', 'Error');
    } finally {
      setRevokingAccess(false);
    }
  };

  const handleToggleRevealPassword = async (trainerId) => {
    if (showPasswords[trainerId]) {
      setShowPasswords(prev => ({ ...prev, [trainerId]: false }));
      return;
    }
    if (revealedPasswords[trainerId]) {
      setShowPasswords(prev => ({ ...prev, [trainerId]: true }));
      return;
    }
    setLoadingPasswordId(trainerId);
    try {
      const res = await getAdminVisiblePassword(trainerId);
      if (res.success && res.data) {
        setRevealedPasswords(prev => ({ ...prev, [trainerId]: res.data }));
        setShowPasswords(prev => ({ ...prev, [trainerId]: true }));
      } else {
        showError(res.message || 'Failed to retrieve trainer password', 'Password Error');
      }
    } catch (err) {
      showError(err?.message || 'Failed to retrieve trainer password', 'Password Error');
    } finally {
      setLoadingPasswordId(null);
    }
  };

  const handleCopyPassword = async (trainerId) => {
    let pwd = revealedPasswords[trainerId];
    if (!pwd) {
      setLoadingPasswordId(trainerId);
      try {
        const res = await getAdminVisiblePassword(trainerId);
        if (res.success && res.data) {
          pwd = res.data;
          setRevealedPasswords(prev => ({ ...prev, [trainerId]: pwd }));
        } else {
          showError(res.message || 'Failed to retrieve password for copying', 'Copy Failed');
          return;
        }
      } catch (err) {
        showError(err?.message || 'Failed to retrieve password', 'Copy Failed');
        return;
      } finally {
        setLoadingPasswordId(null);
      }
    }
    if (pwd) {
      navigator.clipboard.writeText(pwd);
      setCopiedTrainerPasswordId(trainerId);
      setTimeout(() => setCopiedTrainerPasswordId(null), 2000);
    }
  };

  const handleOpenSetPasswordModal = (trainer) => {
    setPasswordModalTrainer(trainer);
    setNewPasswordInput('');
    setPasswordModalError('');
  };

  const handleSaveSetPassword = async (e) => {
    e.preventDefault();
    if (!newPasswordInput || newPasswordInput.trim().length < 8) {
      setPasswordModalError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[a-zA-Z]/.test(newPasswordInput) || !/\d/.test(newPasswordInput)) {
      setPasswordModalError('Password must contain at least one letter and one number.');
      return;
    }
    setPasswordModalLoading(true);
    try {
      const res = await setAdminUserPassword(passwordModalTrainer.id, newPasswordInput.trim());
      if (res.success) {
        setRevealedPasswords(prev => ({ ...prev, [passwordModalTrainer.id]: newPasswordInput.trim() }));
        setShowPasswords(prev => ({ ...prev, [passwordModalTrainer.id]: true }));
        logActivity('Trainer Password Updated', `Admin updated password for trainer "${passwordModalTrainer.name}"`, 'Trainer');
        setPasswordModalTrainer(null);
      } else {
        setPasswordModalError(res.message || 'Failed to update password.');
      }
    } catch (err) {
      setPasswordModalError(err?.message || 'Server error updating password.');
    } finally {
      setPasswordModalLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    specialty: 'English Communication',
    salaryAmount: '25000',
    salaryCreditDate: '25',
    joinedOn: new Date().toISOString().split('T')[0]
  });

  const loadData = async () => {
    const res = await getTrainers();
    setTrainers(res.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const validateEmail = (emailStr) => {
    const trimmed = (emailStr || '').trim();
    if (!trimmed) return 'Email address is required.';
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(trimmed)) return 'Please enter a valid email address.';
    return '';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    const emailErr = validateEmail(formData.email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }
    setEmailError('');

    if (!validatePhone(formData.phone)) {
      setPhoneError(SUBMIT_PHONE_ERROR);
      return;
    }
    setPhoneError('');

    if (!formData.password || formData.password.trim().length < 8) {
      setFormError('Password is required and must be at least 8 characters long.');
      return;
    }
    if (!/[a-zA-Z]/.test(formData.password) || !/\d/.test(formData.password)) {
      setFormError('Password must contain at least one letter and one number.');
      return;
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: sanitizePhone(formData.phone),
      password: formData.password.trim()
    };

    const res = await createTrainer(payload);
    if (!res.success) {
      setFormError(res.message || 'Failed to create trainer.');
      return;
    }

    if (res.data?.id) {
      setRevealedPasswords(prev => ({ ...prev, [res.data.id]: payload.password }));
      setShowPasswords(prev => ({ ...prev, [res.data.id]: true }));
    }

    setCreatedTrainerModalData({
      trainerName: payload.name,
      email: payload.email,
      password: payload.password
    });

    resetForm();
    setShowAddModal(false);
    loadData();
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (editingTrainer) {
      setFormError('');
      const emailErr = validateEmail(formData.email);
      if (emailErr) {
        setEmailError(emailErr);
        return;
      }
      setEmailError('');

      if (!validatePhone(formData.phone)) {
        setPhoneError(SUBMIT_PHONE_ERROR);
        return;
      }
      setPhoneError('');

      if (formData.password && formData.password.trim()) {
        if (formData.password.trim().length < 8) {
          setFormError('Password must be at least 8 characters long.');
          return;
        }
        if (!/[a-zA-Z]/.test(formData.password) || !/\d/.test(formData.password)) {
          setFormError('Password must contain at least one letter and one number.');
          return;
        }
      }

      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: sanitizePhone(formData.phone)
      };
      if (formData.password && formData.password.trim()) {
        payload.password = formData.password.trim();
      } else {
        delete payload.password;
      }

      const res = await updateTrainer(editingTrainer.id, payload);
      if (!res.success) {
        setFormError(res.message || 'Failed to update trainer.');
        return;
      }
      await showSuccess(res.message || 'Trainer updated successfully', 'Trainer Updated');
      setEditingTrainer(null);
      resetForm();
      loadData();
    }
  };

  const handleInitiateDelete = async (trainer) => {
    setDeleteError(null);
    try {
      const impactRes = await getTrainerDeletionImpact(trainer.id);
      if (impactRes && impactRes.data && !impactRes.data.canDelete) {
        setDeleteTrainerData({
          ...trainer,
          canDelete: false,
          blockingReasons: impactRes.data.blockingReasons || []
        });
      } else {
        setDeleteTrainerData({
          ...trainer,
          canDelete: true,
          blockingReasons: []
        });
      }
    } catch {
      setDeleteTrainerData({
        ...trainer,
        canDelete: true,
        blockingReasons: []
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteTrainerData) {
      const res = await deleteTrainer(deleteTrainerData.id);
      if (!res.success) {
        setDeleteError(res.message || 'Failed to delete trainer');
        await showError(res.message || 'Failed to delete trainer', 'Delete Failed');
        return;
      }
      setDeleteTrainerData(null);
      setDeleteError(null);
      await showSuccess(res.message || 'Trainer deleted successfully', 'Trainer Deleted');
      loadData();
    }
  };

  const handleToggleStatus = async (trainer) => {
    if (trainer.status !== 'Inactive') {
      try {
        const depRes = await getTrainerDependencies(trainer.id);
        if (depRes.success && depRes.data?.hasDependencies) {
          setTrainerDepModalData({
            isOpen: true,
            trainer,
            dependencies: depRes.data,
            action: 'INACTIVATE',
            replacementTrainerId: ''
          });
          return;
        }
      } catch (err) {
        console.error('Failed to verify trainer dependencies:', err);
      }
    }
    const newStatus = trainer.status === 'Inactive' ? 'Active' : 'Inactive';
    const res = await updateUserStatus(trainer.id, newStatus);
    if (!res.success) {
      await showError(res.message || 'Failed to update trainer status', 'Status Update Error');
      return;
    }
    await showSuccess(`Trainer status updated to ${newStatus}`, 'Status Updated');
    logActivity('Trainer Status Changed', `Changed status of trainer "${trainer.name}" to ${newStatus}`, 'Trainer');
    loadData();
  };

  const handleConfirmReplacement = async () => {
    if (!trainerDepModalData?.replacementTrainerId) {
      showWarning('Please select an active trainer from the dropdown to reassign courses and batches to.', 'Selection Required');
      return;
    }
    const { trainer, replacementTrainerId, action } = trainerDepModalData;
    let res;
    if (action === 'DELETE') {
      res = await deleteTrainer(trainer.id, replacementTrainerId);
    } else {
      res = await replaceTrainer(trainer.id, {
        newTrainerId: replacementTrainerId,
        action
      });
    }
    if (res.success) {
      logActivity(
        action === 'DELETE' ? 'Trainer Replaced & Deleted' : 'Trainer Replaced & Inactivated',
        `Reassigned courses and batches of "${trainer.name}" to trainer ID "${replacementTrainerId}" and executed ${action}`,
        'Trainer'
      );
      setTrainerDepModalData(null);
      await showSuccess(
        action === 'DELETE' ? 'Trainer replaced and deleted successfully' : 'Trainer replaced and marked inactive',
        'Replacement Complete'
      );
      loadData();
    } else {
      await showError(res.message || 'Failed to replace trainer.', 'Replacement Error');
    }
  };

  const resetForm = () => {
    setEmailError('');
    setPhoneError('');
    setFormError('');
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      specialty: 'English Communication',
      salaryAmount: '25000',
      salaryCreditDate: '25',
      joinedOn: new Date().toISOString().split('T')[0]
    });
  };

  const filteredTrainers = trainers.filter(trainer => {
    // 1. Text Search Filter
    const query = searchTerm.toLowerCase().trim();
    if (query) {
      const matchesSearch = (
        (trainer.name && trainer.name.toLowerCase().includes(query)) ||
        (trainer.email && trainer.email.toLowerCase().includes(query)) ||
        (trainer.phone && trainer.phone.toLowerCase().includes(query)) ||
        (trainer.id && String(trainer.id).toLowerCase().includes(query)) ||
        (trainer.specialty && trainer.specialty.toLowerCase().includes(query))
      );
      if (!matchesSearch) return false;
    }

    // 2. Joined Date Filter (Exact match)
    if (joinedDate) {
      const tDate = trainer.joinedOn || trainer.dateOfJoining;
      if (!tDate) return false;
      if (tDate !== joinedDate) return false;
    }

    return true;
  });

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trainer Management</h1>
          <p className="text-xs text-slate-500 font-medium">Add trainer accounts, set joining dates, and assign specialized subjects.</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md flex items-center space-x-2 text-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Trainer</span>
        </button>
      </div>

      {/* Search & Date Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          
          {/* Text Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="🔍 Search trainers by name, email, phone, specialty or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Single Joined Date Filter */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center space-x-1 text-slate-500 font-bold px-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Joined Date:</span>
            </div>
            <input
              type="date"
              value={joinedDate}
              onChange={(e) => setJoinedDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
              title="Select Joined Date"
            />
            {joinedDate && (
              <button
                onClick={() => setJoinedDate('')}
                className="px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg font-extrabold text-[10px] cursor-pointer"
              >
                Clear Date
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 px-4">Trainer Name</th>
                <th className="py-3 px-4">Email (Login ID)</th>
                <th className="py-3 px-4">Password</th>
                <th className="py-3 px-4">Specialty</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Monthly Salary</th>
                <th className="py-3 px-4">Salary Credit Date</th>
                <th className="py-3 px-4">Date of Joining</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {filteredTrainers.length > 0 ? (
                filteredTrainers.map((trainer) => {
                  const isActive = trainer.status !== 'Inactive';
                  return (
                    <tr key={trainer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-black text-slate-900">{trainer.name}</td>
                      <td className="py-4 px-4 text-blue-900 font-bold">{trainer.email}</td>
                      <td className="py-4 px-4 font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-700 font-bold select-all">
                            {showPasswords[trainer.id] ? (revealedPasswords[trainer.id] || '••••••••') : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleRevealPassword(trainer.id)}
                            disabled={loadingPasswordId === trainer.id}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition-colors"
                            title={showPasswords[trainer.id] ? "Hide password" : "Show password"}
                          >
                            {showPasswords[trainer.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(trainer.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition-colors"
                            title="Copy password"
                          >
                            {copiedTrainerPasswordId === trainer.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-600">{trainer.specialty}</td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleToggleStatus(trainer)}
                          className={`px-3 py-1 rounded-full text-[10px] font-extrabold cursor-pointer border ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-4 px-4 font-black text-emerald-600">₹{parseFloat(trainer.salaryAmount || 25000).toLocaleString()}</td>
                      <td className="py-4 px-4 font-bold text-blue-700">{trainer.salaryCreditDate || '25'}th of every month</td>
                      <td className="py-4 px-4 text-slate-600 font-medium">{trainer.joinedOn || trainer.dateOfJoining || ''}</td>
                      <td className="py-4 px-4 text-slate-500 font-mono">{formatPhone(trainer.phone) || 'N/A'}</td>
                      <td className="py-4 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSetPasswordModal(trainer)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors"
                          title="Set New Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                          setEditingTrainer(trainer);
                          setFormError('');
                          setEmailError('');
                          setPhoneError('');
                          setFormData({
                            name: trainer.name || '',
                            email: trainer.email || '',
                            password: '',
                            phone: trainer.phone || '',
                            specialty: trainer.specialty || 'English Communication',
                            salaryAmount: trainer.salaryAmount || '25000',
                            salaryCreditDate: trainer.salaryCreditDate || '25',
                            joinedOn: trainer.joinedOn || new Date().toISOString().split('T')[0]
                          });
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                        title="Edit Account"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleInitiateDelete(trainer)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Delete Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-500 font-bold text-xs">
                    No trainers found matching your search or date filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editingTrainer) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setShowAddModal(false); setEditingTrainer(null); }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-slate-900">
              {editingTrainer ? 'Edit Trainer Account' : 'Create Trainer Account'}
            </h3>

            <form onSubmit={editingTrainer ? handleUpdate : handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trainer Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trainer Email (Login ID)</label>
                <input
                  type="email"
                  required
                  placeholder="trainer@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, email: val });
                    if (emailError) setEmailError(validateEmail(val));
                  }}
                  className={`w-full px-4 py-2.5 bg-slate-50 border ${emailError ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200'} rounded-xl text-xs font-medium focus:bg-white`}
                />
                {emailError && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1">{emailError}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Salary (₹)</label>
                  <MoneyInput
                    required
                    placeholder="e.g. 25000"
                    value={formData.salaryAmount}
                    onChange={(e) => setFormData({ ...formData, salaryAmount: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Salary Credit Date</label>
                  <select
                    value={formData.salaryCreditDate}
                    onChange={(e) => setFormData({ ...formData, salaryCreditDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {[...Array(31)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}th of every month</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingTrainer ? 'Password (Leave blank to keep unchanged)' : 'Password (min 8 chars, 1 letter, 1 digit) *'}
                  </label>
                  <input
                    type="text"
                    required={!editingTrainer}
                    placeholder={editingTrainer ? "Leave blank to keep existing password" : "e.g. Pass1234!"}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (formError) setFormError('');
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date of Joining</label>
                  <input
                    type="date"
                    required
                    value={formData.joinedOn}
                    onChange={(e) => setFormData({ ...formData, joinedOn: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Specialty Subject</label>
                <input
                  type="text"
                  placeholder="e.g. English Communication & Debate"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (10 Digits) *</label>
                <PhoneInput
                  required
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (phoneError) setPhoneError('');
                  }}
                  error={phoneError}
                  onErrorClear={() => setPhoneError('')}
                />
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg transition-transform text-xs mt-2 cursor-pointer"
              >
                {editingTrainer ? 'Update Account' : 'Create & Issue Credentials'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {createdTrainerModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 text-xs">
            <button
              onClick={() => setCreatedTrainerModalData(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-emerald-600">
              <CheckCircle2 className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="text-base font-black text-slate-900">Trainer Created Successfully!</h3>
                <p className="text-slate-500 text-[11px] font-medium">Account created for {createdTrainerModalData.email}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl space-y-2 border border-slate-800 font-mono text-[11px]">
              <p>Trainer: <strong>{createdTrainerModalData.trainerName}</strong></p>
              <p>Email: <strong>{createdTrainerModalData.email}</strong></p>
              {(createdTrainerModalData.password || createdTrainerModalData.temporaryPassword) && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center justify-between text-amber-300 my-2">
                  <div>
                    <span className="text-[10px] text-amber-400 block font-bold uppercase tracking-wider">Account Password</span>
                    <span className="font-mono font-bold text-sm text-white select-all">{createdTrainerModalData.password || createdTrainerModalData.temporaryPassword}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdTrainerModalData.password || createdTrainerModalData.temporaryPassword);
                      setCopiedPassword(true);
                      setTimeout(() => setCopiedPassword(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    {copiedPassword ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setCreatedTrainerModalData(null)}
              className="w-full bg-blue-600 text-white font-black py-3 rounded-xl shadow-md text-xs cursor-pointer hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTrainerData)}
        title={deleteTrainerData?.canDelete ? "Delete Trainer Account" : "Cannot Delete Trainer"}
        message={
          !deleteTrainerData?.canDelete && deleteTrainerData?.blockingReasons?.length > 0
            ? deleteTrainerData.blockingReasons.join(' ')
            : `Are you sure you want to delete account for "${deleteTrainerData?.name}" (${deleteTrainerData?.email})?`
        }
        confirmText="Delete Trainer"
        confirmDisabled={!deleteTrainerData?.canDelete}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteTrainerData(null);
          setDeleteError(null);
        }}
      />

      {/* Trainer Dependency & Replacement Modal */}
      {trainerDepModalData?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setTrainerDepModalData(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {trainerDepModalData.action === 'DELETE' ? 'Cannot Delete Active Trainer' : 'Active Assignments Detected'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Trainer "{trainerDepModalData.trainer?.name}" is currently assigned to courses and batches.
                </p>
              </div>
            </div>

            {/* Dependency Summary Box */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3 text-xs">
              <span className="font-bold text-amber-900 block uppercase tracking-wider text-[10px]">
                Currently Assigned Dependencies:
              </span>
              
              {trainerDepModalData.dependencies?.courses?.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700">Courses ({trainerDepModalData.dependencies.courses.length}):</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {trainerDepModalData.dependencies.courses.map((c) => (
                      <span key={c.id} className="bg-white border border-amber-200 text-amber-950 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        {c.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {trainerDepModalData.dependencies?.batches?.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700">Batches ({trainerDepModalData.dependencies.batches.length}):</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {trainerDepModalData.dependencies.batches.map((b) => (
                      <span key={b.id} className="bg-white border border-amber-200 text-amber-950 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        {b.name} ({b.courseName})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {trainerDepModalData.dependencies?.schedules?.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700">Live Schedules ({trainerDepModalData.dependencies.schedules.length}):</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {trainerDepModalData.dependencies.schedules.map((s) => (
                      <span key={s.id} className="bg-white border border-amber-200 text-amber-950 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        {s.title} ({s.date})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Replacement Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Select Replacement Trainer to Reassign Courses & Batches *
              </label>
              {trainers.filter(t => t.id !== trainerDepModalData.trainer?.id && t.status !== 'Inactive').length === 0 ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                  No other active trainer is available in the system. You must create or activate another trainer first before deleting or deactivating this trainer.
                </div>
              ) : (
                <select
                  value={trainerDepModalData.replacementTrainerId}
                  onChange={(e) => setTrainerDepModalData({ ...trainerDepModalData, replacementTrainerId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Choose Active Trainer to Inherit Courses & Batches --</option>
                  {trainers
                    .filter(t => t.id !== trainerDepModalData.trainer?.id && t.status !== 'Inactive')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email}) - {t.specialty}
                      </option>
                    ))}
                </select>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setTrainerDepModalData(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!trainerDepModalData.replacementTrainerId}
                onClick={handleConfirmReplacement}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Reassign & {trainerDepModalData.action === 'DELETE' ? 'Delete Trainer' : 'Set Inactive'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set New Password Modal */}
      {passwordModalTrainer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 text-xs">
            <button
              type="button"
              onClick={() => setPasswordModalTrainer(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black text-slate-900">
              Set New Password
            </h3>
            <p className="text-slate-500 text-[11px]">
              Set a new password for <strong>{passwordModalTrainer.name}</strong> ({passwordModalTrainer.email}).
            </p>

            <form onSubmit={handleSaveSetPassword} className="space-y-3">
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">
                  New Password (min 8 chars, 1 letter, 1 digit) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NewPass1234!"
                  value={newPasswordInput}
                  onChange={(e) => {
                    setNewPasswordInput(e.target.value);
                    if (passwordModalError) setPasswordModalError('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              {passwordModalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{passwordModalError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPasswordModalTrainer(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordModalLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl cursor-pointer shadow-md disabled:opacity-50"
                >
                  {passwordModalLoading ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    
      {/* Trainer Enrolled Courses Modal */}
      {showEnrolledCoursesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Trainer Enrolled Courses</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage and review all trainer course allocations and access permissions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrolledCoursesModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by trainer name, email, or course..."
                  value={enrolledCourseSearch}
                  onChange={(e) => setEnrolledCourseSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={enrolledCourseModeFilter}
                  onChange={(e) => setEnrolledCourseModeFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Modes</option>
                  <option value="ONLINE">Online</option>
                  <option value="RECORDED">Recorded</option>
                  <option value="HYBRID">Hybrid</option>
                </select>

                <select
                  value={enrolledCourseTrainerFilter}
                  onChange={(e) => setEnrolledCourseTrainerFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="ALL">All Trainers</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={loadEnrolledCourses}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {loadingEnrolledCourses ? (
                <div className="py-16 text-center text-slate-400 font-bold text-sm">
                  Loading trainer course accesses...
                </div>
              ) : enrolledCoursesList.filter((item) => {
                  if (enrolledCourseModeFilter !== 'ALL' && item.courseMode?.toUpperCase() !== enrolledCourseModeFilter) return false;
                  if (enrolledCourseTrainerFilter !== 'ALL' && item.trainerId !== enrolledCourseTrainerFilter) return false;
                  if (enrolledCourseSearch) {
                    const q = enrolledCourseSearch.toLowerCase();
                    const matchTrainer = item.trainerName?.toLowerCase().includes(q) || item.trainerEmail?.toLowerCase().includes(q) || item.trainerPhone?.includes(q);
                    const matchCourse = item.courseTitle?.toLowerCase().includes(q) || item.courseCategory?.toLowerCase().includes(q);
                    if (!matchTrainer && !matchCourse) return false;
                  }
                  return true;
                }).length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-bold text-sm">
                  {enrolledCoursesList.length === 0
                    ? 'No trainer course enrollments found.'
                    : 'No matching course allocations found for your filter.'}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase font-bold text-[11px]">
                        <th className="py-3 px-4">Trainer</th>
                        <th className="py-3 px-4">Course Title</th>
                        <th className="py-3 px-4">Mode</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Allocated Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {enrolledCoursesList.filter((item) => {
                        if (enrolledCourseModeFilter !== 'ALL' && item.courseMode?.toUpperCase() !== enrolledCourseModeFilter) return false;
                        if (enrolledCourseTrainerFilter !== 'ALL' && item.trainerId !== enrolledCourseTrainerFilter) return false;
                        if (enrolledCourseSearch) {
                          const q = enrolledCourseSearch.toLowerCase();
                          const matchTrainer = item.trainerName?.toLowerCase().includes(q) || item.trainerEmail?.toLowerCase().includes(q) || item.trainerPhone?.includes(q);
                          const matchCourse = item.courseTitle?.toLowerCase().includes(q) || item.courseCategory?.toLowerCase().includes(q);
                          if (!matchTrainer && !matchCourse) return false;
                        }
                        return true;
                      }).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-slate-900">{item.trainerName}</div>
                            <div className="text-[11px] text-slate-500">{item.trainerEmail}</div>
                            {item.trainerPhone && <div className="text-[10px] text-slate-400 font-mono">{item.trainerPhone}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800">{item.courseTitle}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              item.courseMode?.toLowerCase() === 'recorded'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : item.courseMode?.toLowerCase() === 'hybrid'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {item.courseMode || 'Online'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{item.courseCategory || 'General'}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{item.requestDate || 'N/A'}</td>
                          <td className="py-3 px-4">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {item.status || 'Approved'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setRevokeConfirmData(item)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Revoke Access
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>Total Access Records: {enrolledCoursesList.length}</span>
              <button
                type="button"
                onClick={() => setShowEnrolledCoursesModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Access Confirmation Dialog */}
      {revokeConfirmData && (
        <ConfirmModal
          isOpen={Boolean(revokeConfirmData)}
          title="Revoke Course Access"
          message={`Are you sure you want to revoke access for trainer "${revokeConfirmData.trainerName}" on course "${revokeConfirmData.courseTitle}"? The trainer will immediately lose access to lead this course and its materials.`}
          confirmText={revokingAccess ? "Revoking..." : "Revoke Access"}
          confirmDisabled={revokingAccess}
          onConfirm={handleConfirmRevokeAccess}
          onCancel={() => setRevokeConfirmData(null)}
        />
      )}
</div>
  );
}

