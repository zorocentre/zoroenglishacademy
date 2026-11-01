import React, { useState, useEffect } from 'react';
import { 
  Award, CheckCircle2, Clock, Eye, FileText, Filter, Search, 
  Download, Upload, X, Check, BookOpen, UserCheck, MessageSquare, AlertCircle
} from 'lucide-react';
import { getAdminTrainerSubmissions, reviewAdminTrainerSubmission } from '../../api/assignmentApi';
import { getCourses } from '../../api/courseApi';
import { getTrainers } from '../../api/userApi';
import { uploadFile, openFileWithSignedLink } from '../../api/fileApi';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import { useDialog } from '../../context/DialogContext';
import { formatSubmissionTime } from '../../utils/dateFormatter';

export default function AdminTrainerAssignmentsPage() {
  const { showError } = useDialog();
  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  const [selectedTrainerFilter, setSelectedTrainerFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All'); // 'All' | 'Pending' | 'Corrected'

  // Modals
  const [viewerFile, setViewerFile] = useState(null);
  const [reviewingSub, setReviewingSub] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correctedFile, setCorrectedFile] = useState(null);
  const [uploadingCorrection, setUploadingCorrection] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, cRes, trRes] = await Promise.all([
        getAdminTrainerSubmissions(),
        getCourses(),
        getTrainers()
      ]);
      setSubmissions(subRes.data || []);
      setCourses(cRes.data || []);
      setTrainers(trRes.data || []);
    } catch (err) {
      console.error('Failed to load trainer submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReviewModal = (sub) => {
    setReviewingSub(sub);
    setScore(sub.score || '');
    setFeedback(sub.feedback || (sub.status === 'Corrected' ? sub.remarks : '') || '');
    setCorrectedFile(sub.correctedFileUrl ? { name: 'Corrected Document', fileUrl: sub.correctedFileUrl } : null);
  };

  const closeReviewModal = () => {
    setReviewingSub(null);
    setScore('');
    setFeedback('');
    setCorrectedFile(null);
  };

  const handleCorrectedFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCorrection(true);
    try {
      const res = await uploadFile(file, 'correction');
      setCorrectedFile({
        name: file.name,
        fileUrl: res.url
      });
    } catch (err) {
      console.error('File upload failed:', err);
      showError('Failed to upload corrected file: ' + (err.message || 'Unknown error'), 'Upload Error');
    } finally {
      setUploadingCorrection(false);
    }
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!reviewingSub) return;
    setSubmittingReview(true);
    try {
      const reviewPayload = {
        score: score.trim(),
        feedback: feedback.trim(),
        remarks: feedback.trim(),
        status: 'Corrected',
        correctedBy: 'Admin',
        correctedFileUrl: correctedFile?.fileUrl || null
      };

      const res = await reviewAdminTrainerSubmission(reviewingSub.id, reviewPayload);
      if (res.success) {
        setToastMsg(`Submission for "${reviewingSub.studentName || 'Trainer'}" marked as Corrected!`);
        setTimeout(() => setToastMsg(''), 4500);
        closeReviewModal();
        await loadData();
      } else {
        showError(res.message || 'Failed to submit review', 'Review Failed');
      }
    } catch (err) {
      console.error('Review submission error:', err);
      showError('Error saving review: ' + (err.message || 'Unknown error'), 'Save Error');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Filter logic
  const filteredSubmissions = submissions.filter((sub) => {
    // Course filter
    if (selectedCourseFilter !== 'All' && sub.courseTitle !== selectedCourseFilter) {
      return false;
    }
    // Trainer filter
    if (selectedTrainerFilter !== 'All') {
      const trainerMatches = 
        (sub.studentEmail && sub.studentEmail.toLowerCase() === selectedTrainerFilter.toLowerCase()) ||
        (sub.studentName && sub.studentName.toLowerCase() === selectedTrainerFilter.toLowerCase()) ||
        (sub.studentId && sub.studentId === selectedTrainerFilter);
      if (!trainerMatches) return false;
    }
    // Status filter
    if (selectedStatusFilter === 'Pending') {
      if (sub.status === 'Corrected' || sub.status === 'Reviewed') return false;
    } else if (selectedStatusFilter === 'Corrected') {
      if (sub.status !== 'Corrected' && sub.status !== 'Reviewed') return false;
    }
    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const name = (sub.studentName || '').toLowerCase();
      const email = (sub.studentEmail || '').toLowerCase();
      const course = (sub.courseTitle || '').toLowerCase();
      const title = (sub.assignmentTitle || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !course.includes(q) && !title.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const pendingCount = submissions.filter(s => s.status !== 'Corrected' && s.status !== 'Reviewed').length;
  const correctedCount = submissions.filter(s => s.status === 'Corrected' || s.status === 'Reviewed').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Toast */}
      {toastMsg && (
        <div className="p-4 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg('')} className="p-1 hover:bg-emerald-700 rounded-lg">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-indigo-100 text-indigo-800 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            <span>Trainer Professional Programs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Trainer Assignment Submissions
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            Evaluate and score assignments submitted by Zoro Academy trainers enrolled in professional training programs.
          </p>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-2">
          <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <div>
              <div className="text-[10px] font-bold text-amber-800 uppercase">Pending Review</div>
              <div className="text-sm font-black text-amber-950">{pendingCount}</div>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="text-[10px] font-bold text-emerald-800 uppercase">Corrected</div>
              <div className="text-sm font-black text-emerald-950">{correctedCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search trainer, course, or assignment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          {/* Course Filter */}
          <div>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="All">All Courses</option>
              {courses.filter(c => c.audience === 'trainer' || submissions.some(s => s.courseTitle === c.title)).map((c) => (
                <option key={c.id || c.title} value={c.title}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Trainer Filter */}
          <div>
            <select
              value={selectedTrainerFilter}
              onChange={(e) => setSelectedTrainerFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="All">All Trainers</option>
              {trainers.map((t) => (
                <option key={t.id || t.email} value={t.email || t.name}>{t.name} ({t.email})</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
            <button
              onClick={() => setSelectedStatusFilter('All')}
              className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                selectedStatusFilter === 'All' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({submissions.length})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('Pending')}
              className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                selectedStatusFilter === 'Pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('Corrected')}
              className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                selectedStatusFilter === 'Corrected' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Done ({correctedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">
            Loading trainer submissions...
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Award className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-black text-slate-800">No Trainer Submissions Found</h3>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              {submissions.length === 0 
                ? 'No trainers have submitted assignments for trainer programs yet.' 
                : 'No submissions matched your selected filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="py-4 px-6">Trainer</th>
                  <th className="py-4 px-6">Course & Assignment</th>
                  <th className="py-4 px-6">Submitted On</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Score & Feedback</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredSubmissions.map((sub) => {
                  const isDone = sub.status === 'Corrected' || sub.status === 'Reviewed';
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Trainer */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs shrink-0">
                            {(sub.studentName || 'T').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{sub.studentName || 'Trainer'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{sub.studentEmail}</div>
                          </div>
                        </div>
                      </td>

                      {/* Course & Assignment */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800">{sub.courseTitle}</div>
                        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{sub.assignmentTitle}</span>
                        </div>
                      </td>

                      {/* Submitted On */}
                      <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">
                        {formatSubmissionTime(sub.submittedAt || sub.createdAt) || '-'}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                          isDone 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {isDone ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Corrected</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Score & Feedback */}
                      <td className="py-4 px-6 max-w-xs">
                        {isDone ? (
                          <div className="space-y-1">
                            {sub.score && (
                              <span className="inline-block bg-indigo-50 text-indigo-700 font-black text-[11px] px-2 py-0.5 rounded border border-indigo-200">
                                Score: {sub.score}
                              </span>
                            )}
                            {(sub.feedback || sub.remarks) && (
                              <p className="text-[11px] text-slate-600 truncate italic">
                                "{sub.feedback || sub.remarks}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Not evaluated</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right space-x-2">
                        {sub.attachment && (
                          <button
                            type="button"
                            onClick={() => setViewerFile(sub.attachment)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="View submitted file"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>View</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openReviewModal(sub)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>{isDone ? 'Edit Review' : 'Review & Correct'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewingSub && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[90dvh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Review Trainer Assignment</h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    {reviewingSub.courseTitle} • {reviewingSub.assignmentTitle}
                  </p>
                </div>
              </div>
              <button 
                onClick={closeReviewModal}
                className="text-slate-400 hover:text-slate-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submitter Info Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Trainer:</span>
                <span className="font-extrabold text-slate-900">{reviewingSub.studentName} ({reviewingSub.studentEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Submitted On:</span>
                <span className="font-mono text-slate-700">{formatSubmissionTime(reviewingSub.submittedAt || reviewingSub.createdAt)}</span>
              </div>
              {reviewingSub.answerText && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-bold block mb-1">Trainer Submission Notes:</span>
                  <p className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-normal">
                    {reviewingSub.answerText}
                  </p>
                </div>
              )}
              {reviewingSub.attachment && (
                <div className="pt-2 flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>{reviewingSub.attachment.name || 'Submission Document'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewerFile(reviewingSub.attachment)}
                      className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> View File
                    </button>
                    {reviewingSub.attachment.fileUrl && (
                      <button
                        type="button"
                        onClick={() => openFileWithSignedLink(reviewingSub.attachment.fileUrl, reviewingSub.attachment.name)}
                        className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Review Form */}
            <form onSubmit={handleSaveReview} className="space-y-4 text-xs font-bold text-slate-700">
              {/* Score Input */}
              <div>
                <label className="block mb-1 text-slate-800 font-extrabold">
                  Score / Grade <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 95/100 or A+ or 100%"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              {/* Feedback Textarea */}
              <div>
                <label className="block mb-1 text-slate-800 font-extrabold">
                  Admin Feedback & Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="4"
                  placeholder="Enter detailed assessment feedback, congratulations, or corrections for the trainer..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 leading-relaxed"
                />
              </div>

              {/* Optional Corrected File Upload */}
              <div>
                <label className="block mb-1 text-slate-800 font-extrabold">
                  Optional: Upload Corrected / Annotated File
                </label>
                <div className="flex items-center space-x-3">
                  <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 flex items-center space-x-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>{uploadingCorrection ? 'Uploading...' : 'Choose File'}</span>
                    <input 
                      type="file" 
                      onChange={handleCorrectedFileUpload}
                      disabled={uploadingCorrection}
                      className="hidden" 
                    />
                  </label>
                  {correctedFile && (
                    <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <span>✓ {correctedFile.name}</span>
                      <button 
                        type="button" 
                        onClick={() => setCorrectedFile(null)}
                        className="text-emerald-900 hover:text-rose-600"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview || uploadingCorrection}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingReview ? 'Saving Review...' : 'Mark as Corrected'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal File Viewer Modal */}
      {viewerFile && (
        <UniversalFileViewerModal
          isOpen={true}
          onClose={() => setViewerFile(null)}
          file={viewerFile}
          hideDownload={true}
        />
      )}
    </div>
  );
}
