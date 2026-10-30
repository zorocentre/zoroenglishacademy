import React, { useState, useEffect } from 'react';
import { 
  Search, Eye, Edit3, Check, 
  Play, BookOpen, Layers, FileText, UserCheck, X, Award
} from 'lucide-react';
import { getSubmissions, updateCorrection } from '../../api/assignmentApi';
import { getCourses, getTrainerCourseRequests } from '../../api/courseApi';
import { getBatches } from '../../api/batchApi';
import { getTrainerStudents } from '../../api/userApi';
import { useAuth } from '../../context/AuthContext';
import { getTrainerAllocatedCourses, getTrainerAllocatedBatches } from '../../utils/trainerFilterHelper';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import SecureVideoPlayer from '../common/SafeVideo';
import PageLoader from '../common/PageLoader';
import { formatSubmissionTime } from '../../utils/dateFormatter';

function matchesTrainerName(assignedTrainer, currentTrainerName, currentTrainerEmail) {
  if (!assignedTrainer || assignedTrainer === 'None (Self-Paced)' || assignedTrainer === 'Unassigned') return false;
  const a = String(assignedTrainer).toLowerCase().trim();
  const name = String(currentTrainerName || '').toLowerCase().trim();
  const email = String(currentTrainerEmail || '').toLowerCase().trim();
  
  if (name && (a === name || a.includes(name) || name.includes(a))) return true;
  if (email && a === email) return true;
  return false;
}

export default function TrainerSubmissionsPage() {
  const { user } = useAuth();
  const trainerName = user?.name || '';
  const trainerEmail = user?.email || '';

  // Top-Level View Switching Toggle (Requirement 5.2)
  const [mainView, setMainView] = useState('submissions'); // 'submissions' | 'recorded'
  
  // View 1: Submissions State
  const [statusTab, setStatusTab] = useState('pending'); // 'pending' | 'corrected' | 'overdue'
  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [correctionModalSub, setCorrectionModalSub] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({ score: '', feedback: '', remarks: '', status: 'Corrected' });
  const [viewerFile, setViewerFile] = useState(null);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // View 2: Recorded Sessions State
  const [assignedRecordedCourses, setAssignedRecordedCourses] = useState([]);
  const [expandedRecordedCourseId, setExpandedRecordedCourseId] = useState(null);
  const [activeModuleForVideo, setActiveModuleForVideo] = useState(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [subRes, crsRes, btcRes, stdRes, reqsRes] = await Promise.all([
        getSubmissions(),
        getCourses(),
        getBatches(),
        getTrainerStudents(),
        getTrainerCourseRequests()
      ]);

      const allSubmissions = subRes.data || [];
      const allCourses = crsRes.data || [];
      const allBatches = btcRes.data || [];
      const approvedReqs = reqsRes.data || [];
      const allStudents = (stdRes.data || []).filter(s => (s.status || '').toLowerCase() !== 'inactive' && !s.isDeleted);

      setStudents(allStudents);

      const allocatedCrs = getTrainerAllocatedCourses(user, allCourses, allBatches, approvedReqs);
      setCourses(allocatedCrs);

      const allocatedBtcs = getTrainerAllocatedBatches(user, 'All', allocatedCrs, allBatches);
      setBatches(allocatedBtcs);

      const trnSubmissions = allSubmissions.filter(s => 
        matchesTrainerName(s.assignedTrainer, trainerName, trainerEmail) ||
        s.assignedTrainer === trainerName ||
        allocatedCrs.some(c => c.title === s.courseTitle)
      );
      setSubmissions(trnSubmissions);

      const recCourses = allCourses.filter(c => 
        (c.mode || '').toLowerCase().trim() === 'recorded' &&
        (matchesTrainerName(c.assignedTrainer, trainerName, trainerEmail) ||
         (c.trainerId && user?.id && c.trainerId === user.id) ||
         (Array.isArray(c.allocatedTrainers) && (c.allocatedTrainers.includes(trainerName) || c.allocatedTrainers.includes(trainerEmail))))
      );
      setAssignedRecordedCourses(recCourses);
      if (recCourses.length > 0) {
        setExpandedRecordedCourseId(recCourses[0].id);
      } else {
        setExpandedRecordedCourseId(null);
      }
    } catch (err) {
      console.error('Error loading Submissions Page data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user, trainerName, trainerEmail]);

  const availableBatches = getTrainerAllocatedBatches(user, selectedCourse, courses, batches);

  const handleCourseChange = (courseTitle) => {
    setSelectedCourse(courseTitle);
    const newBatches = getTrainerAllocatedBatches(user, courseTitle, courses, batches);
    const isCurrentBatchValid = newBatches.some(b => (b.name || b.title) === selectedBatch);
    if (!isCurrentBatchValid) {
      setSelectedBatch('All');
    }
  };

  // Filter Submissions by status tab, course, batch, and search term (Requirement 7.1, 7.3)
  const filteredSubmissions = submissions.filter(s => {
    const isCorrected = s.status === 'Corrected' || s.status === 'Reviewed';
    const isOverdue = s.status === 'Overdue';

    const matchesStatus = statusTab === 'pending'
      ? (!isCorrected && !isOverdue)
      : statusTab === 'corrected'
      ? isCorrected
      : isOverdue;

    const matchesCourse = selectedCourse === 'All' || s.courseTitle === selectedCourse;
    const matchesBatch = selectedBatch === 'All' || s.batchName === selectedBatch || s.batch === selectedBatch;
    
    // Privacy requirement: Search by Student Name (NO EMAIL DISPLAY)
    const matchesSearch = !searchTerm ||
      (s.studentName && s.studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.assignmentTitle && s.assignmentTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.courseTitle && s.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesCourse && matchesBatch && matchesSearch;
  });

  // Calculate dynamic tab counts (Requirement 7.2)
  const pendingCount = submissions.filter(s => s.status !== 'Corrected' && s.status !== 'Reviewed' && s.status !== 'Overdue').length;
  const correctedCount = submissions.filter(s => s.status === 'Corrected' || s.status === 'Reviewed').length;
  const overdueCount = submissions.filter(s => s.status === 'Overdue').length;

  // Open Correction Modal (Requirement 7.4 & 7.9)
  const handleOpenCorrectionModal = (sub) => {
    setCorrectionModalSub(sub);
    const isAlreadyEvaluated = sub.status === 'Corrected' || sub.status === 'Reviewed';
    setCorrectionForm({
      score: sub.score || '90/100',
      feedback: isAlreadyEvaluated ? (sub.feedback || '') : '',
      remarks: isAlreadyEvaluated ? (sub.trainerRemarks || (sub.feedback ? sub.remarks : '') || '') : '',
      status: isAlreadyEvaluated ? sub.status : 'Corrected'
    });
  };

  // Save Correction persistence (Requirement 7.8)
  const handleSaveCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionModalSub) return;
    setSavingCorrection(true);

    try {
      await updateCorrection(correctionModalSub.id, {
        score: correctionForm.score.trim() || '90/100',
        feedback: correctionForm.feedback.trim(),
        remarks: correctionForm.remarks.trim() || correctionForm.feedback.trim(),
        status: correctionForm.status,
        correctedBy: trainerName
      });

      setToastMsg(`Correction saved for ${correctionModalSub.studentName}'s assignment!`);
      setTimeout(() => setToastMsg(''), 3500);
      setCorrectionModalSub(null);
      await loadAllData();
    } catch (err) {
      console.error('Failed to save correction:', err);
    } finally {
      setSavingCorrection(false);
    }
  };

  // Filter Assigned Recorded Courses for View 2
  const filteredRecordedCourses = assignedRecordedCourses.filter(c => {
    const matchesCourse = selectedCourse === 'All' || c.title === selectedCourse;
    const matchesSearch = !searchTerm || c.title.toLowerCase().includes(searchTerm.toLowerCase()) || (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCourse && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {toastMsg && (
        <div className="p-4 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="p-1 hover:bg-emerald-700 rounded-lg">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trainer Submissions & Recorded Sessions</h1>
          <p className="text-xs text-slate-500 font-medium">Evaluate student homework submissions, grade tasks, and access assigned recorded course modules for {trainerName}.</p>
        </div>

        {/* Top-Level View Switching Toggle (Requirement 5.2) */}
        <div className="flex items-center space-x-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setMainView('submissions')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 ${
              mainView === 'submissions'
                ? 'bg-[#0F52BA] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Assignment Submissions ({submissions.length})</span>
          </button>
          
          <button
            onClick={() => setMainView('recorded')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center space-x-2 ${
              mainView === 'recorded'
                ? 'bg-purple-700 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Assigned Recorded Sessions ({assignedRecordedCourses.length})</span>
          </button>
        </div>
      </div>

      {/* Course & Batch Dependent Filters Bar (Requirement 3.3, 3.4, 5.5) */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={mainView === 'submissions' ? "Search by student name or assignment title..." : "Search recorded courses..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        {/* Course Filter Dropdown */}
        <div className="flex items-center space-x-1.5">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <select 
            value={selectedCourse} 
            onChange={(e) => handleCourseChange(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="All">All Courses</option>
            {courses.map((c) => (
              <option key={c.id || c.title} value={c.title}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Batch Filter Dropdown */}
        <div className="flex items-center space-x-1.5">
          <Layers className="w-4 h-4 text-purple-600" />
          <select 
            value={selectedBatch} 
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="All">All Batches</option>
            {availableBatches.map((b) => (
              <option key={b.id || b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* VIEW 1: ASSIGNMENT SUBMISSIONS MANAGEMENT */}
      {mainView === 'submissions' && (
        <div className="space-y-6">
          
          {/* Status Organization Tabs with Dynamic Counts (Requirement 7.2) */}
          <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
            <button
              onClick={() => setStatusTab('pending')}
              className={`pb-3 transition-colors border-b-2 cursor-pointer ${
                statusTab === 'pending'
                  ? 'border-[#0F52BA] text-[#0F52BA] font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Pending ({pendingCount})
            </button>

            <button
              onClick={() => setStatusTab('corrected')}
              className={`pb-3 transition-colors border-b-2 cursor-pointer ${
                statusTab === 'corrected'
                  ? 'border-[#0F52BA] text-[#0F52BA] font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Corrected ({correctedCount})
            </button>

            <button
              onClick={() => setStatusTab('overdue')}
              className={`pb-3 transition-colors border-b-2 cursor-pointer ${
                statusTab === 'overdue'
                  ? 'border-[#0F52BA] text-[#0F52BA] font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Overdue ({overdueCount})
            </button>
          </div>

          {/* Submissions Table with Real Data (Requirement 7.1) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
            {loading ? (
              <div className="p-8">
                <PageLoader message="Loading student submissions..." />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold text-slate-400">
                No {statusTab} submissions found for the selected Course and Batch filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12">#</th>
                      <th className="py-3.5 px-4">Student Name</th>
                      <th className="py-3.5 px-4">Course</th>
                      <th className="py-3.5 px-4">Batch</th>
                      <th className="py-3.5 px-4">Assignment Topic</th>
                      <th className="py-3.5 px-4">Submitted On</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {filteredSubmissions.map((item, idx) => {
                      const isCorrected = item.status === 'Corrected' || item.status === 'Reviewed';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4 font-mono text-slate-400">{idx + 1}</td>
                          
                          {/* Student Name rendered; Email hidden (Requirement 10) */}
                          <td className="py-4 px-4 font-black text-slate-900">{item.studentName}</td>
                          
                          <td className="py-4 px-4 text-blue-900 font-bold">{item.courseTitle || 'English Course'}</td>
                          <td className="py-4 px-4 font-bold text-purple-900">{item.batchName || 'Unassigned'}</td>
                          <td className="py-4 px-4 text-slate-800 font-bold">{item.assignmentTitle}</td>
                          <td className="py-4 px-4 text-slate-500 font-medium">{formatSubmissionTime(item.submittedAt)}</td>
                          
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                              isCorrected
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : item.status === 'Overdue'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                              {item.status}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleOpenCorrectionModal(item)}
                              className={`font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center space-x-1 ${
                                isCorrected
                                  ? 'bg-purple-700 hover:bg-purple-800 text-white'
                                  : 'bg-[#0F52BA] hover:bg-blue-700 text-white'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{isCorrected ? 'Edit Correction' : 'Correct'}</span>
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
        </div>
      )}

      {/* VIEW 2: ASSIGNED RECORDED SESSIONS (INLINE VIEW - NO MODAL, Requirement 5.3) */}
      {mainView === 'recorded' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 bg-purple-100 text-purple-800 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider mb-1">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Assigned Recorded Sessions</span>
              </div>
              <h2 className="text-xl font-black text-slate-900">Recorded Courses & Student Assessment Tracking</h2>
              <p className="text-xs text-slate-500 font-semibold">Inline access to recorded video lessons, module resources, and enrolled student details assigned to {trainerName}.</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-200">
              <PageLoader message="Loading assigned recorded sessions..." />
            </div>
          ) : filteredRecordedCourses.length === 0 ? (
            <div className="p-12 text-center text-xs font-bold text-slate-400 bg-white rounded-3xl border border-slate-200 space-y-2">
              <Play className="w-12 h-12 text-purple-300 mx-auto" />
              <h3 className="text-base font-black text-slate-800">No Assigned Recorded Sessions Found</h3>
              <p className="text-xs text-slate-500 font-medium">No recorded courses assigned to your account match the selected Course and Batch filters.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredRecordedCourses.map((course) => {
                const isExpanded = expandedRecordedCourseId === course.id;
                const modules = course.modules || [];
                const courseSubs = submissions.filter(s => s.courseTitle === course.title);

                return (
                  <div key={course.id} className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden transition-all">
                    
                    {/* Course Card Header Bar */}
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 border-b border-slate-200/80">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border border-purple-200">
                            {course.mode} MODE
                          </span>
                          <span className="text-xs text-slate-500 font-bold">Trainer: {course.assignedTrainer}</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900">{course.title}</h3>
                        <p className="text-xs text-slate-500 font-semibold">{course.description}</p>
                      </div>

                      <button
                        onClick={() => setExpandedRecordedCourseId(isExpanded ? null : course.id)}
                        className={`px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
                          isExpanded
                            ? 'bg-slate-900 text-white'
                            : 'bg-purple-700 hover:bg-purple-800 text-white shadow-md'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>{isExpanded ? 'Collapse Session' : 'View Recorded Content Inline'}</span>
                      </button>
                    </div>

                    {/* INLINE EXPANDED CONTENT (Requirement 5.3) */}
                    {isExpanded && (
                      <div className="p-6 sm:p-8 space-y-8 bg-white">
                        
                        {/* SECURE VIDEO PLAYER INLINE */}
                        {modules.length > 0 && (
                          <div className="space-y-3 bg-slate-900 p-5 rounded-3xl text-white shadow-xl">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-purple-300">
                                <Play className="w-4 h-4 fill-current text-purple-400" />
                                Video Lesson Stream: {activeModuleForVideo?.title || modules[0].title}
                              </h4>
                              <span className="text-[10px] font-mono text-slate-400">Assigned Educator: {trainerName}</span>
                            </div>
                            
                            <SecureVideoPlayer
                              videoRefData={activeModuleForVideo?.videoStorageRef || modules[0].videoStorageRef}
                              videoTitle={activeModuleForVideo?.title || modules[0].title}
                              courseTitle={course.title}
                              studentName={trainerName}
                              studentEmail={trainerEmail}
                              isAuthorized={true}
                            />
                          </div>
                        )}

                        {/* MODULES & RESOURCES LIST */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <Layers className="w-4 h-4 text-purple-600" />
                            Course Modules & Assessment Attachments ({modules.length})
                          </h4>

                          {modules.length === 0 ? (
                            <div className="p-4 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                              No modules uploaded for this recorded session yet.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {modules.map((mod, idx) => {
                                const isSelVideo = (activeModuleForVideo?.id || modules[0]?.id) === mod.id;
                                return (
                                  <div key={mod.id || idx} className={`p-4 rounded-2xl border transition-all space-y-3 ${
                                    isSelVideo ? 'bg-purple-50/60 border-purple-300' : 'bg-slate-50 border-slate-200/80'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <span className="w-6 h-6 rounded-lg bg-purple-700 text-white font-black text-[11px] flex items-center justify-center">
                                          {idx + 1}
                                        </span>
                                        <h5 className="text-xs font-black text-slate-900">{mod.title}</h5>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => setActiveModuleForVideo(mod)}
                                        className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                                          isSelVideo ? 'bg-purple-700 text-white' : 'bg-white text-purple-700 border border-purple-200'
                                        }`}
                                      >
                                        <Play className="w-3 h-3 fill-current" />
                                        <span>{isSelVideo ? 'Playing' : 'Play Video'}</span>
                                      </button>
                                    </div>

                                    {/* Resources buttons */}
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      {mod.notesPdf && (
                                        <button
                                          type="button"
                                          onClick={() => setViewerFile({ name: mod.notesPdf.name || 'Module Notes', url: mod.notesPdf.url || mod.notesPdf.fileUrl, type: 'pdf' })}
                                          className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                          <FileText className="w-3 h-3 text-emerald-600" />
                                          <span>Notes PDF</span>
                                        </button>
                                      )}

                                      {mod.activitySheetPdf && (
                                        <button
                                          type="button"
                                          onClick={() => setViewerFile({ name: mod.activitySheetPdf.name || 'Worksheet PDF', url: mod.activitySheetPdf.url || mod.activitySheetPdf.fileUrl, type: 'pdf' })}
                                          className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                          <FileText className="w-3 h-3 text-blue-600" />
                                          <span>Worksheet</span>
                                        </button>
                                      )}

                                      {mod.assignmentPdf && (
                                        <button
                                          type="button"
                                          onClick={() => setViewerFile({ name: mod.assignmentPdf.name || 'Assignment PDF', url: mod.assignmentPdf.url || mod.assignmentPdf.fileUrl, type: 'pdf' })}
                                          className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                                          <span>Assignment PDF</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* ENROLLED STUDENTS UNDER RECORDED SESSION (Requirement 5.4 - NO EMAIL DISPLAY) */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          {(() => {
                            const courseStudents = students.filter(s => {
                              if (Array.isArray(s.courseBatches)) {
                                return s.courseBatches.some(cb => 
                                  (cb.courseId && cb.courseId === course.id) ||
                                  (cb.course && cb.course.toLowerCase().trim() === (course.title || '').toLowerCase().trim())
                                );
                              }
                              if (Array.isArray(s.courses)) {
                                return s.courses.some(c => c === course.title || c === course.id);
                              }
                              return false;
                            });

                            return (
                              <>
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <UserCheck className="w-4 h-4 text-purple-600" />
                                  Enrolled Students & Submission Status ({courseStudents.length})
                                </h4>

                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                        <th className="py-3 px-4">#</th>
                                        <th className="py-3 px-4">Student Name</th>
                                        <th className="py-3 px-4">Course</th>
                                        <th className="py-3 px-4">Batch</th>
                                        <th className="py-3 px-4">Submission Status</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                      {courseStudents.length === 0 ? (
                                        <tr>
                                          <td colSpan={6} className="py-6 text-center text-slate-400 font-bold text-xs">
                                            No students currently enrolled in this recorded course.
                                          </td>
                                        </tr>
                                      ) : (
                                        courseStudents.map((s, idx) => {
                                          const sub = courseSubs.find(subItem => 
                                            subItem.studentEmail?.toLowerCase() === s.email?.toLowerCase() ||
                                            subItem.studentName?.toLowerCase() === s.name?.toLowerCase()
                                          );
                                          const isCorrected = sub && (sub.status === 'Corrected' || sub.status === 'Reviewed');

                                          return (
                                            <tr key={s.id || idx} className="hover:bg-slate-50">
                                              <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                                              
                                              {/* Student Name rendered cleanly; Email hidden (Requirement 10) */}
                                              <td className="py-3 px-4 font-black text-slate-900">{s.name}</td>
                                              
                                              <td className="py-3 px-4 text-slate-700">{course.title}</td>
                                              <td className="py-3 px-4 font-bold text-purple-900">{s.batch || (s.courseBatches?.find(cb => cb.course === course.title)?.batch) || 'Self-Paced'}</td>
                                              
                                              <td className="py-3 px-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                                  isCorrected
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                    : sub
                                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                  {isCorrected ? '✓ Corrected' : sub ? 'Pending Review' : 'No Submission'}
                                                </span>
                                              </td>

                                              <td className="py-3 px-4 text-right">
                                                {sub ? (
                                                  <button
                                                    onClick={() => handleOpenCorrectionModal(sub)}
                                                    className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[11px] px-3 py-1 rounded-lg cursor-pointer"
                                                  >
                                                    {isCorrected ? 'Edit Correction' : 'Correct'}
                                                  </button>
                                                ) : (
                                                  <span className="text-[11px] text-slate-400 italic">Not Submitted</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CORRECTION & GRADING MODAL (Requirements 7.4, 7.5, 7.6, 7.7, 7.8, 7.9) */}
      {correctionModalSub && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            
            <button
              type="button"
              onClick={() => setCorrectionModalSub(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Assignment Evaluation & Grading</span>
              {/* Student Name displayed; Email hidden */}
              <h3 className="text-xl font-black text-slate-900 mt-1">{correctionModalSub.studentName}</h3>
              <p className="text-xs text-slate-500 font-semibold">
                Course: {correctionModalSub.courseTitle} • Batch: {correctionModalSub.batchName || 'Unassigned'}
              </p>
            </div>

            {/* Submitted Info Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-900 text-sm">{correctionModalSub.assignmentTitle}</span>
                <span className="text-slate-500 font-bold">{formatSubmissionTime(correctionModalSub.submittedAt)}</span>
              </div>

              {/* Student Remarks Read-Only Section (Requirement C2) */}
              {(correctionModalSub.remarks || correctionModalSub.answerText) && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Student Remarks</span>
                  <p className="font-semibold text-slate-900 break-words whitespace-pre-wrap">
                    {correctionModalSub.remarks || correctionModalSub.answerText}
                  </p>
                </div>
              )}

              {/* View Attachment with UniversalFileViewerModal (Requirement 7.5) */}
              {correctionModalSub.attachment && (
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2 font-bold text-slate-800">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="truncate max-w-[220px]">{correctionModalSub.attachment.name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewerFile(correctionModalSub.attachment)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Submission File</span>
                  </button>
                </div>
              )}
            </div>

            {/* Correction & Grading Form (Requirements 7.6, 7.7, 7.8) */}
            <form onSubmit={handleSaveCorrectionSubmit} className="space-y-4 text-xs font-bold text-slate-700 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-900 font-extrabold">Grade / Score *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 95/100 or A+"
                    value={correctionForm.score}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, score: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-900 font-extrabold">Evaluation Status *</label>
                  <select
                    value={correctionForm.status}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="Corrected">Corrected</option>
                    <option value="Reviewed">Reviewed</option>
                    <option value="Pending Correction">Pending Correction</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-900 font-extrabold">Trainer Feedback (Visible to Student) *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide detailed feedback on performance, strengths, and areas to improve..."
                  value={correctionForm.feedback}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, feedback: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-600 font-bold">Trainer Remarks / Internal Notes</label>
                <input
                  type="text"
                  placeholder="Optional internal remarks..."
                  value={correctionForm.remarks}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, remarks: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCorrectionModalSub(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCorrection}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md cursor-pointer flex items-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingCorrection ? 'Saving...' : 'Save Correction & Persist'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Universal File Viewer Modal */}
      <UniversalFileViewerModal
        isOpen={Boolean(viewerFile)}
        onClose={() => setViewerFile(null)}
        file={viewerFile}
        hideDownload={true}
      />

    </div>
  );
}
