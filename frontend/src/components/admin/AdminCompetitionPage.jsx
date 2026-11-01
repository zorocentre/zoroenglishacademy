import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, Plus, Search, Calendar, Clock, MapPin, 
  FileText, Download, Edit, Trash2, Eye, X,
  Layers
} from 'lucide-react';
import { getCompetitions, createCompetition, updateCompetition, deleteCompetition } from '../../api/competitionApi';
import { uploadFile, resolveFileUrl, deleteFile, getRulesDownloadUrl } from '../../api/fileApi';
import ConfirmModal from '../common/ConfirmModal';
import MoneyInput from '../common/MoneyInput';
import { formatDate } from '../../utils/dateFormatter';
import { useDialog } from '../../context/DialogContext';
import AdminCompetitionPortalManagerModal from './AdminCompetitionPortalManagerModal';

const toIsoOrNull = (val) => {
  if (!val) return null;
  try {
    if (typeof val === 'string' && val.includes('T') && !val.includes('Z') && !val.includes('+')) {
      return `${val}:00+05:30`;
    }
    return new Date(val).toISOString();
  } catch {
    return null;
  }
};

const toLocalInput = (isoStr, fallbackDate, fallbackTime) => {
  if (isoStr) {
    try {
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).formatToParts(d);
        const getVal = (type) => parts.find(p => p.type === type)?.value || '00';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}T${getVal('hour')}:${getVal('minute')}`;
      }
    } catch {}
  }
  if (fallbackDate) {
    const t = fallbackTime || '00:00';
    const cleanT = t.includes(':') ? t.slice(0, 5) : '00:00';
    return `${fallbackDate}T${cleanT}`;
  }
  return '';
};

const getDefaultPublishAt = (endAtStr, timeStr = '18:00') => {
  if (!endAtStr) return '';
  try {
    const d = new Date(endAtStr);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 5);
      const [h, m] = (timeStr && timeStr.includes(':')) ? timeStr.split(':') : [18, 0];
      d.setHours(parseInt(h, 10) || 18, parseInt(m, 10) || 0, 0, 0);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  } catch {}
  return '';
};

export default function AdminCompetitionPage() {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useDialog();

  const [competitions, setCompetitions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingComp, setEditingComp] = useState(null);
  const [viewingComp, setViewingComp] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [managingPortalComp, setManagingPortalComp] = useState(null);

  const [bannerPreview, setBannerPreview] = useState('');
  const [rulesFileName, setRulesFileName] = useState('');
  const rulesFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Academic',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    regStartDate: '',
    regEndDate: '',
    venue: '',
    registrationFee: '',
    instructions: '',
    rules: '',
    contactDetails: '',
    bannerUrl: '',
    rulesPdfUrl: '',
    finalUnlockAt: '',
    leaderboardPublishTime: '',
    answerReviewEnabled: false
  });

  const loadData = async () => {
    try {
      const compRes = await getCompetitions();
      setCompetitions(compRes.data || []);
    } catch (err) {
      console.error('Failed loading competition data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'Academic',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      regStartDate: '',
      regEndDate: '',
      regStartAt: '',
      regEndAt: '',
      startAt: '',
      endAt: '',
      venue: '',
      registrationFee: '',
      instructions: '',
      rules: '',
      contactDetails: '',
      bannerUrl: '',
      rulesPdfUrl: '',
      finalUnlockAt: '',
      leaderboardPublishTime: '18:00',
      answerReviewEnabled: false
    });
    setBannerPreview('');
    setRulesFileName('');
    if (rulesFileInputRef.current) {
      rulesFileInputRef.current.value = '';
    }
  };

  const timingErrors = useMemo(() => {
    const errs = {};
    if (formData.startAt && formData.endAt) {
      if (new Date(formData.endAt) <= new Date(formData.startAt)) {
        errs.endAt = 'Competition end date/time must be strictly after start date/time';
      }
    }
    if (formData.regEndAt && formData.startAt) {
      if (new Date(formData.regEndAt) > new Date(formData.startAt)) {
        errs.regEndAt = 'Registration closes before or when the competition starts';
      }
    }
    if (formData.finalUnlockAt) {
      if (formData.startAt && new Date(formData.finalUnlockAt) < new Date(formData.startAt)) {
        errs.finalUnlockAt = 'Final Assessment unlock time must be inside the competition window';
      }
      if (formData.endAt && new Date(formData.finalUnlockAt) > new Date(formData.endAt)) {
        errs.finalUnlockAt = 'Final Assessment unlock time must be inside the competition window';
      }
    }
    if (formData.leaderboardPublishTime && formData.endAt) {
      if (new Date(formData.leaderboardPublishTime) < new Date(formData.endAt)) {
        errs.leaderboardPublishTime = 'Leaderboard publish cannot be before competition end';
      }
    }
    return errs;
  }, [formData.startAt, formData.endAt, formData.regEndAt, formData.finalUnlockAt, formData.leaderboardPublishTime]);

  const hasTimingErrors = Object.keys(timingErrors).length > 0;

  const handleEndAtChange = (newEndAt) => {
    const updated = { ...formData, endAt: newEndAt };
    if (!formData.leaderboardPublishTime || formData.leaderboardPublishTime === getDefaultPublishAt(formData.endAt)) {
      updated.leaderboardPublishTime = getDefaultPublishAt(newEndAt);
    }
    setFormData(updated);
  };

  const validateTimings = () => {
    if (hasTimingErrors) {
      const firstError = Object.values(timingErrors)[0];
      showWarning(firstError, 'Timing Validation');
      return false;
    }
    return true;
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showWarning('Banner image size must be under 5MB.', 'File Too Large');
        return;
      }
      try {
        const res = await uploadFile(file, 'banner');
        setBannerPreview(res.url);
        setFormData(prev => ({ ...prev, bannerUrl: res.url }));
      } catch (err) {
        showError(err.message || 'Banner upload failed', 'Upload Error');
      }
    }
  };

  const handleRulesPdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        showWarning('Rules document must be a PDF file.', 'Invalid File Type');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showWarning('Rules document size must not exceed 10 MB.', 'File Too Large');
        return;
      }
      const oldUrl = formData.rulesPdfUrl;
      try {
        const res = await uploadFile(file, 'public-document');
        setRulesFileName(file.name);
        setFormData(prev => ({ ...prev, rulesPdfUrl: res.url || `/api/files/${res.id}/download` }));
        if (oldUrl && oldUrl !== res.url) {
          const match = oldUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
          if (match && match[0] !== res.id) {
            try {
              await deleteFile(match[0]);
            } catch (ignored) {}
          }
        }
      } catch (err) {
        showError(err.message || 'Rules document upload failed', 'Upload Error');
      }
    }
  };

  const handleRemoveRulesPdf = async () => {
    const oldUrl = formData.rulesPdfUrl;
    setFormData(prev => ({ ...prev, rulesPdfUrl: '' }));
    setRulesFileName('');
    if (rulesFileInputRef.current) {
      rulesFileInputRef.current.value = '';
    }
    if (oldUrl) {
      const match = oldUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (match) {
        try {
          await deleteFile(match[0]);
        } catch (ignored) {}
      }
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    if (!validateTimings()) return;

    const { status: _omittedCreateStatus, ...cleanCreateForm } = formData;
    const payload = {
      ...cleanCreateForm,
      registrationFee: formData.registrationFee !== '' ? Number(formData.registrationFee) : 0,
      regStartAt: toIsoOrNull(formData.regStartAt),
      regEndAt: toIsoOrNull(formData.regEndAt),
      startAt: toIsoOrNull(formData.startAt),
      endAt: toIsoOrNull(formData.endAt),
      finalUnlockAt: toIsoOrNull(formData.finalUnlockAt),
      leaderboardPublishTime: formData.leaderboardPublishTime || '18:00',
      answerReviewEnabled: Boolean(formData.answerReviewEnabled),
      startDate: formData.startAt ? formData.startAt.slice(0, 10) : formData.startDate,
      endDate: formData.endAt ? formData.endAt.slice(0, 10) : formData.endDate,
      regStartDate: formData.regStartAt ? formData.regStartAt.slice(0, 10) : formData.regStartDate,
      regEndDate: formData.regEndAt ? formData.regEndAt.slice(0, 10) : formData.regEndDate
    };
    try {
      const res = await createCompetition(payload);
      if (res && res.success) {
        setShowAddModal(false);
        resetForm();
        await showSuccess(res.message || 'Competition created successfully', 'Competition Created');
        await loadData();
      } else {
        await showError(res?.message || 'Failed to create competition', 'Creation Failed');
      }
    } catch (err) {
      await showError(err?.message || 'Failed to create competition', 'Creation Failed');
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editingComp || !formData.title.trim()) return;
    if (!validateTimings()) return;

    const { status: _omittedUpdateStatus, ...cleanUpdateForm } = formData;
    const payload = {
      ...cleanUpdateForm,
      registrationFee: formData.registrationFee !== '' ? Number(formData.registrationFee) : 0,
      regStartAt: toIsoOrNull(formData.regStartAt),
      regEndAt: toIsoOrNull(formData.regEndAt),
      startAt: toIsoOrNull(formData.startAt),
      endAt: toIsoOrNull(formData.endAt),
      finalUnlockAt: toIsoOrNull(formData.finalUnlockAt),
      leaderboardPublishTime: formData.leaderboardPublishTime || '18:00',
      answerReviewEnabled: Boolean(formData.answerReviewEnabled),
      startDate: formData.startAt ? formData.startAt.slice(0, 10) : formData.startDate,
      endDate: formData.endAt ? formData.endAt.slice(0, 10) : formData.endDate,
      regStartDate: formData.regStartAt ? formData.regStartAt.slice(0, 10) : formData.regStartDate,
      regEndDate: formData.regEndAt ? formData.regEndAt.slice(0, 10) : formData.regEndDate
    };
    try {
      const res = await updateCompetition(editingComp.id, payload);
      if (res && res.success) {
        setEditingComp(null);
        resetForm();
        await showSuccess(res.message || 'Competition updated successfully', 'Competition Updated');
        await loadData();
      } else {
        await showError(res?.message || 'Failed to update competition', 'Update Failed');
      }
    } catch (err) {
      await showError(err?.message || 'Failed to update competition', 'Update Failed');
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      try {
        const res = await deleteCompetition(deleteId);
        setDeleteId(null);
        if (res && res.success) {
          await showSuccess(res.message || 'Competition deleted successfully', 'Competition Deleted');
          await loadData();
        } else {
          await showError(res?.message || 'Failed to delete competition', 'Delete Failed');
        }
      } catch (err) {
        setDeleteId(null);
        await showError(err?.message || 'Failed to delete competition', 'Delete Failed');
      }
    }
  };

  const openEdit = (comp) => {
    setEditingComp(comp);
    const startAtVal = toLocalInput(comp.startAt, comp.startDate, comp.startTime);
    const endAtVal = toLocalInput(comp.endAt, comp.endDate, comp.endTime);
    const regStartAtVal = toLocalInput(comp.regStartAt, comp.regStartDate, null);
    const regEndAtVal = toLocalInput(comp.regEndAt, comp.regEndDate, null);
    const finalUnlockAtVal = toLocalInput(comp.finalUnlockAt || comp.final_unlock_at || comp.unlockDate);
    const publishVal = toLocalInput(comp.leaderboardPublishedAt)
      || (comp.leaderboardPublishTime?.includes('T') ? toLocalInput(comp.leaderboardPublishTime) : '')
      || getDefaultPublishAt(endAtVal, comp.leaderboardPublishTime || '18:00');

    setFormData({
      title: comp.title || comp.name || '',
      description: comp.description || '',
      category: comp.category || 'Academic',
      startDate: comp.startDate || comp.date || '',
      endDate: comp.endDate || comp.startDate || comp.date || '',
      startTime: comp.startTime || '',
      endTime: comp.endTime || '',
      regStartDate: comp.regStartDate || '',
      regEndDate: comp.regEndDate || comp.deadline || '',
      regStartAt: regStartAtVal,
      regEndAt: regEndAtVal,
      startAt: startAtVal,
      endAt: endAtVal,
      venue: comp.venue || '',
      registrationFee: comp.registrationFee !== null && comp.registrationFee !== undefined ? String(comp.registrationFee) : '',
      instructions: comp.instructions || '',
      rules: comp.rules || '',
      contactDetails: comp.contactDetails || '',
      bannerUrl: comp.bannerUrl || comp.banner || '',
      rulesPdfUrl: comp.rulesPdfUrl || comp.rulesPdf?.url || '',
      finalUnlockAt: finalUnlockAtVal,
      leaderboardPublishTime: publishVal,
      answerReviewEnabled: Boolean(comp.answerReviewEnabled)
    });
    setBannerPreview(comp.bannerUrl || comp.banner || '');
    setRulesFileName(comp.rulesPdfUrl || comp.rulesPdf?.url ? 'Saved Rules Document (PDF)' : '');
    if (rulesFileInputRef.current) {
      rulesFileInputRef.current.value = '';
    }
  };

  const filteredCompetitions = competitions.filter(comp => {
    const title = comp.title || comp.name || '';
    const desc = comp.description || '';
    const cat = comp.category || '';
    const matchesSearch = !searchTerm || (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesStatus = selectedStatusFilter === 'All' || comp.status === selectedStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = competitions.length;
  const activeCount = competitions.filter(c => c.status === 'Active' || c.status === 'Registration Open').length;
  const upcomingCount = competitions.filter(c => c.status === 'Upcoming').length;
  const completedCount = competitions.filter(c => c.status === 'Completed' || c.status === 'Finished').length;

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-amber-500" />
            <span>Academy Competition Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Create, manage, and publish academic showdowns, eligibility rules, guidelines, and PDF documents.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-[#0F52BA] hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md flex items-center space-x-2 text-xs sm:text-sm self-start sm:self-auto cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Competition</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Total Competitions</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount} Contests</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-emerald-600 font-semibold">Active Contests</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{activeCount} Active</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-blue-600 font-semibold">Upcoming Contests</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{upcomingCount} Scheduled</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Completed</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{completedCount} Contests</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search competitions by title, category, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Competition Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompetitions.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">No competitions found</h3>
            <p className="text-xs text-slate-400">Try adjusting search or filters, or create a new competition.</p>
          </div>
        ) : (
          filteredCompetitions.map((comp) => {
            const bannerSrc = comp.bannerUrl || comp.banner;
            const compTitle = comp.title || comp.name || 'Competition';
            const compFee = Number(comp.registrationFee || 0);

            return (
              <div key={comp.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col justify-between hover:shadow-lg transition-shadow">
                <div>
                  {/* Banner Header */}
                  <div className="relative h-44 bg-slate-900 overflow-hidden">
                    {bannerSrc ? (
                      <img
                        src={resolveFileUrl(bannerSrc)}
                        alt={compTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/assets/course-placeholder.svg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-800 to-indigo-950 flex flex-col items-center justify-center text-white/30 p-4 text-center">
                        <Trophy className="w-12 h-12 mb-2" />
                        <span className="text-xs font-bold text-white/70 line-clamp-1">{compTitle}</span>
                      </div>
                    )}
                    <span className={`absolute top-3 right-3 text-[10px] font-black px-3 py-1 rounded-full shadow-md ${
                      comp.status === 'Active' ? 'bg-emerald-500 text-white' : comp.status === 'Upcoming' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {comp.status}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3 text-xs">
                    <div>
                      {comp.category && (
                        <div className="text-[10px] font-bold uppercase text-[#0F52BA] tracking-wider">{comp.category}</div>
                      )}
                      <h3 className="text-base font-black text-slate-900 mt-0.5 line-clamp-1">{compTitle}</h3>
                      {comp.description && (
                        <p className="text-slate-500 text-xs mt-1 line-clamp-2">{comp.description}</p>
                      )}
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5 font-medium text-slate-700">
                      {(comp.startDate || comp.date) && (
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Dates: <strong className="text-slate-900">{formatDate(comp.startDate || comp.date)}{comp.endDate && comp.endDate !== (comp.startDate || comp.date) ? ` – ${formatDate(comp.endDate)}` : ''}</strong></span>
                        </div>
                      )}

                      {(comp.startTime || comp.endTime) && (
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Timing: <strong className="text-slate-900">{comp.startTime}{comp.endTime ? ` – ${comp.endTime}` : ''}</strong></span>
                        </div>
                      )}

                      {(comp.regStartDate || comp.regEndDate || comp.deadline) && (
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Registration: <strong className="text-slate-900">{formatDate(comp.regStartDate || '')}{comp.regEndDate || comp.deadline ? ` – ${formatDate(comp.regEndDate || comp.deadline)}` : ''}</strong></span>
                        </div>
                      )}

                      {comp.venue && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="truncate">Venue: <strong className="text-slate-900">{comp.venue}</strong></span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                        <span className="text-slate-500 font-bold">Fee:</span>
                        <span className="font-black text-emerald-700">
                          {compFee > 0 ? `₹${compFee.toLocaleString('en-IN')}` : 'FREE'}
                        </span>
                      </div>
                    </div>

                    {/* Attached Files Badges */}
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                      {(comp.rulesPdfUrl || comp.rulesPdf) && (
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg flex items-center gap-1">
                          <FileText className="w-3 h-3 text-amber-600" />
                          Rules PDF
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setViewingComp(comp)}
                    className="flex-1 bg-white hover:bg-slate-100 text-slate-800 font-bold py-2 rounded-xl border border-slate-200 flex items-center justify-center space-x-1.5 text-xs cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>View Details</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate(`/admin/competition-management?comp=${comp.id}`);
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold px-3 py-2 rounded-xl border border-indigo-200 flex items-center justify-center space-x-1.5 text-xs cursor-pointer"
                    title="Manage Competition Portal (Sets, Syllabus, Videos, Materials, Assessments)"
                  >
                    <Trophy className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Portal</span>
                  </button>

                  <button
                    onClick={() => openEdit(comp)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer"
                    title="Edit Competition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeleteId(comp.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                    title="Delete Competition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {(showAddModal || editingComp) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative space-y-4 max-h-[90dvh] overflow-y-auto text-xs">
            <button
              onClick={() => { setShowAddModal(false); setEditingComp(null); }}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>{editingComp ? 'Edit Competition Details' : 'Create New Competition'}</span>
            </h3>

            <form onSubmit={editingComp ? handleUpdateSubmit : handleCreateSubmit} className="space-y-4">
              
              {/* Competition Title & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Competition Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. National Abacus Championship"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category / Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Academic, Oratory, Abacus"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Registration Fee */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Registration Fee (₹)</label>
                <MoneyInput
                  placeholder="e.g. 500 (Leave blank or 0 for Free)"
                  value={formData.registrationFee}
                  onChange={(e) => setFormData({ ...formData, registrationFee: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white"
                />
              </div>

              {/* Registration Window (datetime-local in IST) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Registration Opens (IST)</label>
                  <input
                    type="datetime-local"
                    value={formData.regStartAt}
                    onChange={(e) => setFormData({ ...formData, regStartAt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Registration Closes (IST)</label>
                  <input
                    type="datetime-local"
                    value={formData.regEndAt}
                    onChange={(e) => setFormData({ ...formData, regEndAt: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-semibold text-xs ${timingErrors.regEndAt ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`}
                  />
                  {timingErrors.regEndAt && (
                    <p className="text-[11px] text-red-600 font-bold mt-1">{timingErrors.regEndAt}</p>
                  )}
                </div>
              </div>

              {/* Venue / Platform */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Venue / Platform</label>
                <input
                  type="text"
                  placeholder="e.g. Online (Competition Portal)"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                />
              </div>

              {/* Contact Details */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact Details / Helpline</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210 | info@zoroacademy.com"
                  value={formData.contactDetails}
                  onChange={(e) => setFormData({ ...formData, contactDetails: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              {/* Description & Instructions */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Competition Description</label>
                <textarea
                  rows="2"
                  placeholder="Brief summary of the competition..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Instructions & Rules Summary</label>
                <textarea
                  rows="2"
                  placeholder="Detailed guidelines, requirements, scoring rules..."
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              {/* Competition Portal Timings & Review Settings */}
              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-4">
                <div className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Competition Portal Timings & Answer Review</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Competition Starts At (IST)</label>
                    <input
                      type="datetime-local"
                      value={formData.startAt}
                      onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Competition Ends At (IST)</label>
                    <input
                      type="datetime-local"
                      value={formData.endAt}
                      onChange={(e) => handleEndAtChange(e.target.value)}
                      className={`w-full px-3 py-2 bg-white border rounded-xl font-semibold text-xs ${timingErrors.endAt ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`}
                    />
                    {timingErrors.endAt && (
                      <p className="text-[11px] text-red-600 font-bold mt-1">{timingErrors.endAt}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Final Assessment Unlocks At (IST)</label>
                    <input
                      type="datetime-local"
                      value={formData.finalUnlockAt}
                      onChange={(e) => setFormData({ ...formData, finalUnlockAt: e.target.value })}
                      className={`w-full px-3 py-2 bg-white border rounded-xl font-semibold text-xs ${timingErrors.finalUnlockAt ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`}
                    />
                    {timingErrors.finalUnlockAt ? (
                      <p className="text-[11px] text-red-600 font-bold mt-1">{timingErrors.finalUnlockAt}</p>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">Must be within the competition window</span>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Leaderboard & Answers Publish At (IST)</label>
                    <input
                      type="datetime-local"
                      value={formData.leaderboardPublishTime}
                      onChange={(e) => setFormData({ ...formData, leaderboardPublishTime: e.target.value })}
                      className={`w-full px-3 py-2 bg-white border rounded-xl font-semibold text-xs ${timingErrors.leaderboardPublishTime ? 'border-red-400 bg-red-50/50' : 'border-slate-200'}`}
                    />
                    {timingErrors.leaderboardPublishTime ? (
                      <p className="text-[11px] text-red-600 font-bold mt-1">{timingErrors.leaderboardPublishTime}</p>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Defaults to 5 days after competition end at 18:00 IST
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-indigo-100/60">
                  <input
                    type="checkbox"
                    id="answerReviewEnabled"
                    checked={formData.answerReviewEnabled}
                    onChange={(e) => setFormData({ ...formData, answerReviewEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="answerReviewEnabled" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Enable Answer Review (Allow students to view question review & explanations after assessment)
                  </label>
                </div>
              </div>

              {/* File Upload Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 text-xs">Attached Documents & Media</div>

                {/* Banner Image */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Banner Image (File or URL)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="text-[11px] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">OR</span>
                    <input
                      type="text"
                      placeholder="Image URL"
                      value={formData.bannerUrl}
                      onChange={(e) => {
                        setFormData({ ...formData, bannerUrl: e.target.value });
                        setBannerPreview(e.target.value);
                      }}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                  {bannerPreview && (
                    <img
                      src={resolveFileUrl(bannerPreview)}
                      alt="Preview"
                      className="h-16 w-32 object-cover rounded-xl border border-slate-200 mt-2"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/assets/course-placeholder.svg';
                      }}
                    />
                  )}
                </div>

                {/* Rules Document (PDF) */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Rules Document (.pdf)</label>
                  {formData.rulesPdfUrl ? (
                    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center gap-2 truncate mr-2">
                        <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                        <span className="text-xs font-bold text-amber-900 truncate">
                          {rulesFileName || 'Saved Rules Document (PDF)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => rulesFileInputRef.current?.click()}
                          className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveRulesPdf}
                          className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        ref={rulesFileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleRulesPdfUpload}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={rulesFileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleRulesPdfUpload}
                        className="w-full text-[11px] file:mr-2 file:py-1.5 file:px-2.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-800"
                      />
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={hasTimingErrors}
                className="w-full bg-[#0F52BA] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl shadow-md text-xs mt-2 cursor-pointer transition-colors"
              >
                {editingComp ? 'Update Competition' : 'Publish Competition'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {viewingComp && (() => {
        const title = viewingComp.title || viewingComp.name || 'Competition';
        const fee = Number(viewingComp.registrationFee || 0);
        const rulesUrl = viewingComp.rulesPdfUrl || viewingComp.rulesPdf?.url;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative space-y-4 max-h-[90dvh] overflow-y-auto text-xs">
              <button
                onClick={() => setViewingComp(null)}
                className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-3 py-1 rounded-full">
                    {viewingComp.status || 'Active'}
                  </span>
                  {viewingComp.category && (
                    <span className="bg-blue-100 text-blue-800 font-extrabold text-[10px] px-3 py-1 rounded-full">
                      {viewingComp.category}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-black text-slate-900">{title}</h2>
                
                {viewingComp.description && (
                  <div className="text-slate-600 font-medium leading-relaxed">{viewingComp.description}</div>
                )}

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-slate-700 font-semibold">
                  <div>
                    <strong>Registration Fee:</strong>{' '}
                    <span className="text-emerald-700 font-black">
                      {fee > 0 ? `₹${fee.toLocaleString('en-IN')}` : 'FREE'}
                    </span>
                  </div>

                  {(viewingComp.regStartDate || viewingComp.regEndDate) && (
                    <div>
                      <strong>Registration Period:</strong>{' '}
                      {formatDate(viewingComp.regStartDate)}{viewingComp.regEndDate ? ` – ${formatDate(viewingComp.regEndDate)}` : ''}
                    </div>
                  )}

                  {(viewingComp.startDate || viewingComp.endDate) && (
                    <div>
                      <strong>Competition Dates:</strong>{' '}
                      {formatDate(viewingComp.startDate)}{viewingComp.endDate && viewingComp.endDate !== viewingComp.startDate ? ` – ${formatDate(viewingComp.endDate)}` : ''}
                    </div>
                  )}

                  {(viewingComp.startTime || viewingComp.endTime) && (
                    <div>
                      <strong>Time:</strong>{' '}
                      {viewingComp.startTime}{viewingComp.endTime ? ` – ${viewingComp.endTime}` : ''}
                    </div>
                  )}

                  {viewingComp.venue && (
                    <div><strong>Venue:</strong> {viewingComp.venue}</div>
                  )}

                  {viewingComp.contactDetails && (
                    <div><strong>Contact Details:</strong> {viewingComp.contactDetails}</div>
                  )}
                </div>

                {viewingComp.instructions && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Instructions & Guidelines:</h4>
                    <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-medium whitespace-pre-line">
                      {viewingComp.instructions}
                    </div>
                  </div>
                )}

                {/* Downloadable Files */}
                {rulesUrl && (
                  <div className="space-y-2 pt-2">
                    <h4 className="font-bold text-slate-900">Official Attachments:</h4>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={getRulesDownloadUrl(rulesUrl)}
                        download
                        className="px-3 py-2 bg-amber-600 text-white font-bold rounded-xl flex items-center gap-1.5 hover:bg-amber-700 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Rules (PDF)</span>
                      </a>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Competition"
        message="Are you sure you want to delete this competition? Students will no longer see or register for it."
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* COMPETITION PORTAL MANAGER MODAL */}
      <AdminCompetitionPortalManagerModal
        competition={managingPortalComp}
        isOpen={Boolean(managingPortalComp)}
        onClose={() => setManagingPortalComp(null)}
      />

    </div>
  );
}
