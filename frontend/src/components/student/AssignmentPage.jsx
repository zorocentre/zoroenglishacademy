import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Upload, FileText, Download, Play, 
  CheckCircle2, Clock, AlertCircle, File, Eye, Award, MessageSquare, BookOpen, Layers, Check, Plus, Lock, Send, X, ExternalLink
} from 'lucide-react';
import { getStudentEnrolledCourses } from '../../api/enrollmentApi';
import { getCourseById } from '../../api/courseApi';
import { getSchedules } from '../../api/scheduleApi';
import { getSubmissions, getCreatedAssignments, createSubmission } from '../../api/assignmentApi';
import { uploadFile as uploadFileApi, openFileWithSignedLink, resolveFileUrl } from '../../api/fileApi';
import { useAuth } from '../../context/AuthContext';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import PageLoader from '../common/PageLoader';
import { useDialog } from '../../context/DialogContext';
import { getSessionStartDateTime, getNowInKolkata, syncServerTime } from '../../utils/scheduleSortUtil';
import { formatSubmissionTime } from '../../utils/dateFormatter';

export default function AssignmentPage({ setActiveScreen }) {
  const { user } = useAuth();
  const { showError } = useDialog();

  const [loading, setLoading] = useState(true);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [createdAssignments, setCreatedAssignments] = useState([]);

  // Filters & Tabs
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'submitted' | 'evaluated' | 'extra'
  const [viewerFile, setViewerFile] = useState(null);

  // Direct Submission modal/inline state
  const [submittingItem, setSubmittingItem] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const studentIdentifier = user?.email || user?.id || '';
  const studentName = user?.name || '';
  const studentBatch = user?.batch || (user?.courseBatches?.[0]?.batch) || '';

  useEffect(() => {
    loadData();
  }, [studentIdentifier, studentName]);

  const loadData = async () => {
    setLoading(true);
    try {
      await syncServerTime();
      // 1. Fetch real enrolled courses for student
      const enrolledRaw = await getStudentEnrolledCourses(studentIdentifier);
      const fullCourses = await Promise.all(
        enrolledRaw.map(async (e) => {
          try {
            const cRes = await getCourseById(e.id);
            if (cRes.success && cRes.data) {
              return {
                ...cRes.data,
                batchName: e.batch || cRes.data.batchName || 'Unassigned',
                assignedTrainer: cRes.data.assignedTrainer || 'Course Trainer'
              };
            }
          } catch (err) {}
          return {
            ...e,
            batchName: e.batch || 'Unassigned',
            assignedTrainer: 'Course Trainer'
          };
        })
      );
      setEnrolledCourses(fullCourses);

      // 2. Fetch schedules for student
      const schRes = await getSchedules();
      setSchedules(schRes.data || []);

      // 3. Fetch submissions for student
      const subsRes = await getSubmissions();
      const allSubs = subsRes.data || [];
      const studentSubs = allSubs.filter(s => 
        (s.studentEmail && studentIdentifier && s.studentEmail.toLowerCase() === studentIdentifier.toLowerCase()) ||
        (s.studentId && user?.id && s.studentId === user?.id) ||
        (s.studentName && studentName && s.studentName.toLowerCase() === studentName.toLowerCase())
      );
      setSubmissions(studentSubs);

      // 4. Fetch extra assignments targeted to student
      const asgRes = await getCreatedAssignments(user?.id || user?.email);
      const targetedAsgs = asgRes.data || [];
      setCreatedAssignments(targetedAsgs);
    } catch (err) {
      console.error('Error loading student assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compile full unified list of course assignments
  const compiledAssignments = [];
  const nowInKolkata = getNowInKolkata();
  const nowMs = nowInKolkata.getTime();

  enrolledCourses.forEach(course => {
    // 1. Recorded Course Modules
    if (course.mode === 'Recorded' && Array.isArray(course.modules)) {
      course.modules.forEach((mod, modIdx) => {
        if (!mod || mod.deleted || mod.isDeleted || mod.status === 'deleted') return;
        const hasAssignment = Boolean(
          mod.assignmentFileUrl || mod.assignmentFileName || mod.assignmentPdf || mod.assignmentFile
        );
        if (!hasAssignment) return;

        const isLocked = Boolean(mod.locked || mod.isLocked);
        if (isLocked) return; // Only show assignments for unlocked modules

        const sub = submissions.find(s => 
          s.sourceId === mod.id || 
          (s.assignmentTitle && mod.title && s.assignmentTitle.toLowerCase().includes(mod.title.toLowerCase()))
        );

        let status = 'PENDING';
        if (sub) {
          status = (sub.status === 'Corrected' || sub.status === 'Reviewed') ? 'EVALUATED' : 'SUBMITTED';
        }

        const taskDoc = (
          mod.assignmentPdf || 
          (mod.assignmentFileUrl ? { name: mod.assignmentFileName || `${mod.title} Task Document.pdf`, fileUrl: mod.assignmentFileUrl } : null) ||
          mod.assignmentFile
        );

        compiledAssignments.push({
          id: `mod_${mod.id || modIdx}`,
          sourceType: 'module',
          sourceId: mod.id,
          courseId: course.id,
          courseTitle: course.title,
          courseMode: 'Recorded',
          batchName: course.batchName || 'Unassigned',
          assignedTrainer: course.assignedTrainer || 'Course Trainer',
          order: mod.moduleOrder || (modIdx + 1),
          sectionLabel: `Module ${modIdx + 1}: ${mod.title}`,
          title: mod.assignmentFileName || `${mod.title} Assignment Task`,
          description: mod.description || 'Module homework and exercise assignment.',
          isLocked: false,
          lockReason: '',
          taskDoc,
          submission: sub || null,
          status
        });
      });
    }

    // 2. Online / Hybrid Course Live Sessions
    if (course.mode === 'Online' || course.mode === 'Hybrid') {
      const courseSchedules = schedules.filter(s => 
        (s.courseId === course.id || (s.course && s.course.toLowerCase() === course.title.toLowerCase())) &&
        (s.assignmentPdf || s.assignmentFileUrl)
      );

      courseSchedules.forEach((sch, sIdx) => {
        // Only include if session start time has arrived
        const start = getSessionStartDateTime(sch.date, sch.startTime || sch.time);
        if (start && nowMs < start.getTime()) return;

        const isLocked = Boolean(sch.locked || sch.isLocked);
        const sub = submissions.find(s => 
          s.sourceId === sch.id || 
          (s.assignmentTitle && sch.title && s.assignmentTitle.toLowerCase().includes(sch.title.toLowerCase()))
        );

        let status = 'PENDING';
        if (isLocked) {
          status = 'LOCKED';
        } else if (sub) {
          status = (sub.status === 'Corrected' || sub.status === 'Reviewed') ? 'EVALUATED' : 'SUBMITTED';
        }

        const taskDoc = isLocked ? null : (
          sch.assignmentPdf || 
          (sch.assignmentFileUrl ? { name: sch.assignmentFileName || `${sch.title} Assignment.pdf`, fileUrl: sch.assignmentFileUrl } : null)
        );

        compiledAssignments.push({
          id: `sch_${sch.id || sIdx}`,
          sourceType: 'schedule',
          sourceId: sch.id,
          courseId: course.id,
          courseTitle: course.title,
          courseMode: course.mode || 'Online',
          batchName: sch.batch || course.batchName || 'Unassigned',
          assignedTrainer: sch.trainer || course.assignedTrainer || 'Course Trainer',
          sessionDate: sch.date,
          sessionTime: sch.startTime || sch.time,
          order: sIdx + 1,
          sectionLabel: `Live Class: ${sch.title}`,
          title: sch.assignmentFileName || `${sch.title} Session Assignment`,
          description: `Live session homework for class on ${sch.date || 'upcoming session'}`,
          isLocked,
          lockReason: 'Unlocks 30 minutes before live session',
          taskDoc,
          submission: sub || null,
          status
        });
      });
    }
  });

  // 3. Extra Assignments
  const extraList = createdAssignments.map(asg => {
    const existingSub = submissions.find(s => 
      s.sourceId === asg.id || 
      (s.assignmentTitle && asg.title && s.assignmentTitle.toLowerCase().includes(asg.title.toLowerCase()))
    );

    let status = 'PENDING';
    if (existingSub) {
      status = (existingSub.status === 'Corrected' || existingSub.status === 'Reviewed') ? 'EVALUATED' : 'SUBMITTED';
    }

    return {
      id: `extra_${asg.id}`,
      sourceType: 'extra',
      sourceId: asg.id,
      courseTitle: asg.course || 'English Communication',
      batchName: asg.batch || studentBatch || 'All',
      assignedTrainer: asg.createdBy || 'Course Trainer',
      title: asg.title,
      description: asg.description,
      dueDate: asg.dueDate,
      taskDoc: asg.attachment || null,
      submission: existingSub || null,
      status
    };
  });

  // Filter by selected course
  const filteredCourseAssignments = compiledAssignments.filter(item => 
    selectedCourseFilter === 'All' || item.courseTitle === selectedCourseFilter
  );

  const filteredExtraAssignments = extraList.filter(item => 
    selectedCourseFilter === 'All' || item.courseTitle === selectedCourseFilter
  );

  // Tab filter counts based on current course filter
  const allList = filteredCourseAssignments;
  const pendingCount = allList.filter(a => a.status === 'PENDING').length;
  const submittedCount = allList.filter(a => a.status === 'SUBMITTED').length;
  const evaluatedCount = allList.filter(a => a.status === 'EVALUATED').length;
  const extraCount = filteredExtraAssignments.length;

  // Filtered display items based on activeTab
  let displayItems = [];
  if (activeTab === 'all') {
    displayItems = allList;
  } else if (activeTab === 'pending') {
    displayItems = allList.filter(a => a.status === 'PENDING');
  } else if (activeTab === 'submitted') {
    displayItems = allList.filter(a => a.status === 'SUBMITTED');
  } else if (activeTab === 'evaluated') {
    displayItems = allList.filter(a => a.status === 'EVALUATED');
  } else if (activeTab === 'extra') {
    displayItems = filteredExtraAssignments;
  }

  // Handle direct file upload in submission form
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    try {
      const res = await uploadFileApi(file, 'submission');
      setSubmissionFile({
        name: file.name,
        fileUrl: res.url,
        type: ext,
        size: sizeMb
      });
    } catch (err) {
      showError(err.message || 'File upload failed', 'Upload Error');
    }
  };

  // Submit assignment solution directly from AssignmentPage
  const handleSubmitSolution = async (e) => {
    e.preventDefault();
    if (!submittingItem) return;

    setIsSubmitting(true);
    try {
      await createSubmission({
        mode: submittingItem.courseMode || 'Online',
        courseTitle: submittingItem.courseTitle,
        batchName: submittingItem.batchName || 'Unassigned',
        studentName: studentName,
        studentEmail: studentIdentifier,
        studentId: user?.id,
        assignmentTitle: submittingItem.title,
        sourceType: submittingItem.sourceType,
        sourceId: submittingItem.sourceId,
        courseId: submittingItem.courseId,
        attachment: submissionFile || null,
        answerText: submissionNotes.trim() || 'Completed assignment solution.',
        assignedTrainer: submittingItem.assignedTrainer || 'Course Trainer'
      });

      setSuccessMsg(`Assignment "${submittingItem.title}" submitted successfully! Trainer will review and assign score.`);
      setTimeout(() => setSuccessMsg(''), 4500);

      setSubmittingItem(null);
      setSubmissionFile(null);
      setSubmissionNotes('');
      await loadData();
    } catch (err) {
      showError(err.message || 'Failed to submit assignment', 'Submission Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <button 
            onClick={() => setActiveScreen ? setActiveScreen('student-dash') : window.history.back()}
            className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Course Assignments</h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Complete your module tasks, check homework deadlines, and view trainer evaluation scores.
          </p>
        </div>

        {/* Real Filter Dropdown: Only student's enrolled courses */}
        <div className="flex items-center space-x-2 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200 shadow-xs">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-500">Course:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            disabled={enrolledCourses.length === 0}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer disabled:text-slate-400"
          >
            {enrolledCourses.length === 0 ? (
              <option value="All">No Enrolled Courses</option>
            ) : (
              <>
                <option value="All">All Courses ({enrolledCourses.length})</option>
                {enrolledCourses.map((c) => (
                  <option key={c.id} value={c.title}>{c.title}</option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      {/* Real Tab Counts */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2 sm:gap-6 text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-1 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'all'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Assignments ({allList.length})
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 px-1 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'pending'
              ? 'border-amber-600 text-amber-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Pending ({pendingCount})
        </button>

        <button
          onClick={() => setActiveTab('submitted')}
          className={`pb-3 px-1 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'submitted'
              ? 'border-purple-600 text-purple-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Submitted ({submittedCount})
        </button>

        <button
          onClick={() => setActiveTab('evaluated')}
          className={`pb-3 px-1 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'evaluated'
              ? 'border-emerald-600 text-emerald-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Evaluated ({evaluatedCount})
        </button>

        <button
          onClick={() => setActiveTab('extra')}
          className={`pb-3 px-1 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'extra'
              ? 'border-indigo-600 text-indigo-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Extra Assignments ({extraCount})
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* LOADING STATE */}
      {loading ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200">
          <PageLoader message="Loading assignments from your courses..." />
        </div>
      ) : enrolledCourses.length === 0 ? (
        /* EMPTY STATE: STUDENT HAS NO COURSES */
        <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">No Enrolled Courses Yet</h3>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            You are not enrolled in any courses yet. Once you enroll in a course, assignments assigned by your trainer will appear here.
          </p>
          <button
            onClick={() => setActiveScreen ? setActiveScreen('student-course-learn') : (window.location.href = '/student/courses')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md inline-flex items-center space-x-2"
          >
            <span>Browse Courses to Enroll</span>
          </button>
        </div>
      ) : displayItems.length === 0 ? (
        /* EMPTY STATE: NO ASSIGNMENTS UNDER CURRENT FILTER */
        <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">No Assignments Found</h3>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            No assignments match the selected filter. Check other tabs or look back once new course exercises are published.
          </p>
        </div>
      ) : (
        /* REAL ASSIGNMENTS GRID */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayItems.map((item) => {
            const isLocked = item.isLocked;
            const sub = item.submission;
            const isEvaluated = item.status === 'EVALUATED';
            const isSubmitted = item.status === 'SUBMITTED';

            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-3xl border shadow-md p-6 space-y-5 flex flex-col justify-between transition-all ${
                  isLocked ? 'border-slate-200/80 bg-slate-50/60 opacity-85' : 'border-slate-200/90'
                }`}
              >
                <div className="space-y-4">
                  
                  {/* Card Header Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${
                      item.courseMode === 'Recorded' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      item.courseMode === 'Online' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {item.courseMode || 'COURSE'} MODE
                    </span>

                    <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border flex items-center gap-1 ${
                      isLocked ? 'bg-slate-200 text-slate-600 border-slate-300' :
                      isEvaluated ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      isSubmitted ? 'bg-purple-100 text-purple-800 border-purple-300' :
                      'bg-amber-100 text-amber-900 border-amber-300'
                    }`}>
                      {isLocked ? (
                        <>
                          <Lock className="w-3 h-3 text-slate-500" />
                          <span>LOCKED</span>
                        </>
                      ) : isEvaluated ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Evaluated & Graded</span>
                        </>
                      ) : isSubmitted ? (
                        <>
                          <Clock className="w-3 h-3 text-purple-600" />
                          <span>Pending Review</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>Pending Submission</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Section Label & Title */}
                  <div>
                    {item.sectionLabel && (
                      <span className="text-[11px] font-mono text-slate-400 font-extrabold block">
                        {item.sectionLabel}
                      </span>
                    )}
                    <h3 className="text-base font-black text-slate-900 mt-0.5">{item.title}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{item.description}</p>
                  </div>

                  {/* Course Details Box */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 text-xs space-y-1.5 font-semibold text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Course:</span>
                      <span className="font-extrabold text-slate-900">{item.courseTitle}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Batch / Trainer:</span>
                      <span className="text-slate-700">
                        {(() => {
                          const hasBatch = item.batchName && item.batchName !== 'Unassigned' && item.batchName.trim() !== '';
                          const hasTrainer = item.assignedTrainer && item.assignedTrainer !== 'Course Trainer' && item.assignedTrainer.trim() !== '';
                          if (hasBatch && hasTrainer) return `${item.batchName} • ${item.assignedTrainer}`;
                          if (hasBatch) return item.batchName;
                          if (hasTrainer) return item.assignedTrainer;
                          return '-';
                        })()}
                      </span>
                    </div>
                    {item.sessionDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Session Time:</span>
                        <span className="text-blue-700 font-bold">{item.sessionDate} at {item.sessionTime}</span>
                      </div>
                    )}
                    {item.dueDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Due Date:</span>
                        <span className="text-purple-700 font-bold">{item.dueDate}</span>
                      </div>
                    )}
                  </div>

                  {/* TASK ATTACHMENT VIEW (Guarded by locking) */}
                  {isLocked ? (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-xs text-rose-700 font-bold">
                      <Lock className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{item.lockReason}</span>
                    </div>
                  ) : item.taskDoc ? (
                    <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-2xl flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 font-bold text-purple-950 truncate max-w-[220px]">
                        <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="truncate">{item.taskDoc.name || 'Task Document.pdf'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setViewerFile(item.taskDoc)}
                          className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-700 font-black rounded-lg border border-purple-200 flex items-center space-x-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>

                      </div>
                    </div>
                  ) : null}

                  {/* SUBMISSION / EVALUATION DETAILS */}
                  {sub && (
                    <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                        <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">Submitted Work</span>
                        <span className="text-[10px] font-mono text-slate-400">{formatSubmissionTime(sub.submittedAt)}</span>
                      </div>

                      {sub.answerText && (
                        <p className="text-xs text-slate-200 font-medium italic">"{sub.answerText}"</p>
                      )}

                      {sub.attachment && (
                        <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 text-xs">
                          <span className="font-bold text-slate-200 truncate max-w-[200px]">📄 {sub.attachment.name}</span>
                          <button
                            type="button"
                            onClick={() => setViewerFile(sub.attachment)}
                            className="text-purple-400 hover:text-purple-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </div>
                      )}

                      {/* Trainer Review Display */}
                      {isEvaluated ? (
                        <div className="p-3.5 bg-emerald-950/70 border border-emerald-700/60 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-black">
                            <span className="text-emerald-300 flex items-center gap-1">
                              <Award className="w-4 h-4 text-emerald-400" /> Trainer Evaluation
                            </span>
                            {sub.score && (
                              <span className="bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded-md font-black">
                                Score: {sub.score}
                              </span>
                            )}
                          </div>
                          {sub.remarks ? (
                            <p className="text-xs text-emerald-100 font-semibold leading-relaxed">
                              "{sub.remarks}"
                            </p>
                          ) : (
                            <p className="text-[11px] text-emerald-300/80 italic">Corrected by {sub.correctedBy || item.assignedTrainer}</p>
                          )}
                          {sub.correctedFileUrl && (
                            <div className="flex items-center justify-between bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-700/60 text-xs mt-2">
                              <span className="font-bold text-emerald-200 truncate max-w-[200px]">📄 Corrected Assignment</span>
                              <button
                                type="button"
                                onClick={() => setViewerFile({ name: 'Corrected Assignment', url: sub.correctedFileUrl, type: 'pdf' })}
                                className="text-emerald-300 hover:text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-emerald-400 text-right">
                            Reviewed on {sub.correctedAt}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs text-amber-300 font-semibold flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Awaiting trainer correction. Marks and remarks will appear once graded.</span>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Card Action Button (When not locked and not yet submitted) */}
                {!isLocked && !sub && (
                  <div>
                    {submittingItem?.id === item.id ? (
                      /* Inline Quick Submission Form */
                      <form onSubmit={handleSubmitSolution} className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-black text-purple-950 uppercase">Submit Solution</h5>
                          <button 
                            type="button" 
                            onClick={() => { setSubmittingItem(null); setSubmissionFile(null); }}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Upload Solution File *</label>
                          {submissionFile ? (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-bold">
                              <span>📄 {submissionFile.name}</span>
                              <button 
                                type="button" 
                                onClick={() => setSubmissionFile(null)}
                                className="text-rose-600 font-bold hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <input
                              type="file"
                              required
                              onChange={handleFileUpload}
                              className="w-full text-xs bg-white p-2 rounded-xl border border-slate-200 cursor-pointer"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Remarks *</label>
                          <textarea
                            rows={2}
                            required
                            placeholder="Add your notes or remarks for your trainer..."
                            value={submissionNotes}
                            onChange={(e) => setSubmissionNotes(e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                          />
                        </div>

                        {(() => {
                          const isSubmitValid = Boolean(submissionFile && submissionNotes && submissionNotes.trim().length > 0);
                          return (
                            <div className="space-y-1.5">
                              <button
                                type="submit"
                                disabled={!isSubmitValid || isSubmitting}
                                className={`w-full font-extrabold py-2.5 rounded-xl text-xs shadow-md inline-flex items-center justify-center space-x-2 transition-all ${
                                  isSubmitValid && !isSubmitting
                                    ? 'bg-purple-700 hover:bg-purple-800 text-white cursor-pointer'
                                    : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                                }`}
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{isSubmitting ? 'Submitting...' : 'Submit Solution'}</span>
                              </button>
                              {!isSubmitValid && (
                                <p className="text-[11px] text-amber-700 font-semibold text-center italic">
                                  Upload your file and add notes to submit
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSubmittingItem(item)}
                        className="w-full bg-purple-700 hover:bg-purple-800 text-white font-black py-2.5 rounded-xl text-xs shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-transform active:scale-98"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Submit Assignment Solution</span>
                      </button>
                    )}
                  </div>
                )}

              </div>
            );
          })}
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
