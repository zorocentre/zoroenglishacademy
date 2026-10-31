import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Play, FileText, BookOpen, PlusCircle, Sparkles, ExternalLink, Calendar, Clock, Video, Lock, Unlock, Layers, CheckCircle2, Eye, Send, Award, Download } from 'lucide-react';
import { getCourses, getCourseById, getTrainerCourseRequests } from '../../api/courseApi';
import { getStudentEnrolledCourses } from '../../api/enrollmentApi';
import { createEnquiry, getMyEnquiries } from '../../api/enquiryApi';
import { getStudentProgress, getStudentModuleProgress, authorizeVideoPlayback } from '../../api/progressApi';
import { getSchedules, joinSchedule } from '../../api/scheduleApi';
import { getSubmissions, createSubmission, getMyTrainerSubmissions } from '../../api/assignmentApi';
import { uploadFile, resolveFileUrl } from '../../api/fileApi';
import { useAuth } from '../../context/AuthContext';
import SecureVideoPlayer from '../common/SecureVideoPlayer';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import PageLoader from '../common/PageLoader';
import { useDialog } from '../../context/DialogContext';
import { evaluateScheduleLocks, getScheduleJoinState, syncServerTime } from '../../utils/scheduleSortUtil';
import { formatSubmissionTime } from '../../utils/dateFormatter';
import { usePolling } from '../../hooks/usePolling';


export default function CourseLearningPage({ courseId: initialCourseId, initialCourse = null, _setActiveScreen, isTrainerLearning = false, onBack }) {
  const { user } = useAuth();
  const isTrainer = isTrainerLearning || user?.role === 'TRAINER';
  const { showError } = useDialog();
  const [activeTab, setActiveTab] = useState(initialCourseId || initialCourse ? 'learn' : 'my-courses'); // 'my-courses' | 'explore' | 'learn'
  const [hybridTab, setHybridTab] = useState('live'); // 'live' | 'recorded'
  
  const [availableCourses, setAvailableCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(initialCourse || null);
  const [activeModule, setActiveModule] = useState(initialCourse?.modules?.[0] || null);
  const [viewerFile, setViewerFile] = useState(null);
  
  const [allSchedules, setAllSchedules] = useState([]);
  const [studentProgressMap, setStudentProgressMap] = useState({});
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [enquiriesList, setEnquiriesList] = useState([]);
  const [assessmentFile, setAssessmentFile] = useState(null);
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [authMsg, setAuthMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [playbackData, setPlaybackData] = useState(null);
  const [justUnlockedModuleId, setJustUnlockedModuleId] = useState(null);
  const [, setTimerTick] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  // Periodically re-evaluate schedule locks every 30s without needing full refresh (Requirement B3)
  usePolling(async () => {
    setTimerTick(prev => prev + 1);
    try {
      const schRes = await getSchedules();
      if (schRes?.data) setAllSchedules(schRes.data);
    } catch {
      // ignore
    }
  }, 30000, Boolean(selectedCourse));

  const studentIdentifier = user?.email || user?.id || '';
  const studentName = user?.name || '';

  const loadSubmissionsData = async () => {
    try {
      const res = isTrainer ? await getMyTrainerSubmissions() : await getSubmissions();
      if (res.data) setStudentSubmissions(res.data);
    } catch (err) {
      console.error('Error loading submissions:', err);
    }
  };

  useEffect(() => {
    syncServerTime();
    loadAllData();
    loadSubmissionsData();
  }, [studentIdentifier, isTrainer]);

  useEffect(() => {
    if (activeModule?.id && selectedCourse?.id && studentIdentifier) {
      authorizeVideoPlayback(studentIdentifier, selectedCourse.id, activeModule.id).then(res => {
        if (res.success && res.data) {
          setIsAuthorized(true);
          setPlaybackData(res.data);
        } else {
          setIsAuthorized(false);
          setAuthMsg(res.message || 'Access Denied: You are not enrolled in this course.');
          setPlaybackData(null);
        }
      });
    }
  }, [activeModule?.id, selectedCourse?.id, studentIdentifier]);

  const loadAllData = async () => {
    setLoadingData(true);
    try {
      const coursesRes = await getCourses();
      const allCourses = coursesRes.data || [];

      if (isTrainer) {
        let requests = [];
        try {
          const reqRes = await getTrainerCourseRequests(user?.id);
          if (reqRes?.data) requests = reqRes.data;
        } catch {
          // ignore
        }
        const trainerCourses = allCourses.filter(c => c.audience?.toLowerCase() === 'trainer');
        setAvailableCourses(trainerCourses);

        const enrolled = trainerCourses.filter(c => {
          const req = requests.find(r => 
            ((user?.id && r.trainerId === user.id) ||
             (user?.email && r.trainerEmail && r.trainerEmail.toLowerCase().trim() === user.email.toLowerCase().trim())) && 
            r.courseId === c.id
          );
          const isExactTrainer = Boolean(user?.id && c.trainerId && c.trainerId === user.id);
          return isExactTrainer || (req && req.status === 'Approved');
        });
        setEnrolledCourses(enrolled);
      } else {
        const studentCourses = allCourses.filter(c => !c.audience || c.audience?.toLowerCase() === 'student');
        setAvailableCourses(studentCourses);

        const enrolledRaw = await getStudentEnrolledCourses(studentIdentifier);
        const enrolled = enrolledRaw.map(e => {
          const fullCourse = allCourses.find(c => c.id === e.id || c.title === e.title);
          return {
            ...(fullCourse || {}),
            ...e,
            batchName: e.batch || fullCourse?.batchName || 'Unassigned',
            assignedTrainer: fullCourse?.assignedTrainer || 'Course Trainer'
          };
        });
        setEnrolledCourses(enrolled);
      }

      const schRes = await getSchedules();
      setAllSchedules(schRes.data || []);

      const enqRes = await getMyEnquiries();
      setEnquiriesList(enqRes.data || []);

      await loadSubmissionsData();

      if (initialCourseId || initialCourse) {
        const targetId = initialCourseId || initialCourse?.id;
        const target = allCourses.find(c => c.id === targetId) || initialCourse || (isTrainer ? allCourses.find(c => c.audience?.toLowerCase() === 'trainer') : allCourses.find(c => !c.audience || c.audience?.toLowerCase() === 'student'));
        if (target) selectCourseToLearn(target);
      } else {
        setActiveTab('my-courses');
      }
    } catch (err) {
      console.error('Error loading LMS data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleStudentAssessmentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    try {
      const res = await uploadFile(file, 'submission');
      setAssessmentFile({
        name: file.name,
        fileUrl: res.url,
        type: ext,
        size: sizeMb
      });
    } catch (err) {
      showError(err.message || 'Assessment file upload failed', 'Upload Error');
    }
  };

  const handleSubmitStudentAssessment = async (e) => {
    e.preventDefault();
    if (!activeModule || !selectedCourse) return;

    setAssessmentSubmitting(true);
    try {
      const assignmentDoc = activeModule.assignmentPdf || activeModule.assignmentFile;
      const title = assignmentDoc?.name || `${activeModule.title} Assignment`;

      await createSubmission({
        mode: selectedCourse.mode || 'Recorded',
        courseTitle: selectedCourse.title,
        batchName: selectedCourse.batchName || 'Unassigned',
        studentName: studentName,
        studentEmail: studentIdentifier,
        studentId: user?.id,
        trainerId: selectedCourse.trainerId,
        assignmentTitle: title,
        sourceType: 'module',
        sourceId: activeModule.id,
        courseId: selectedCourse.id,
        attachment: assessmentFile || null,
        answerText: assessmentNotes.trim() || 'Completed assignment solution.',
        assignedTrainer: isTrainer ? 'Admin' : (selectedCourse.assignedTrainer || 'Course Trainer'),
        submitterRole: isTrainer ? 'TRAINER' : 'STUDENT',
        reviewer: isTrainer ? 'ADMIN' : 'TRAINER'
      });

      const currentIdx = modulesList.findIndex(m => m.id === activeModule.id);
      if (currentIdx >= 0 && currentIdx + 1 < modulesList.length) {
        const nextMod = modulesList[currentIdx + 1];
        setJustUnlockedModuleId(nextMod.id);
        setMsg(`Assignment submitted successfully! Module ${currentIdx + 2} unlocked.`);
        setTimeout(() => setJustUnlockedModuleId(null), 3000);
      } else {
        setMsg(isTrainer ? 'Assignment submitted to Admin for review successfully!' : 'Assignment submitted successfully! Trainer will review and assign score.');
      }
      setTimeout(() => setMsg(''), 4500);

      setAssessmentFile(null);
      setAssessmentNotes('');
      await loadSubmissionsData();

      // Refresh student progress from backend immediately
      if (selectedCourse?.id && studentIdentifier) {
        const [progRes, modProgRes] = await Promise.all([
          getStudentProgress(studentIdentifier, selectedCourse.id),
          getStudentModuleProgress(studentIdentifier, selectedCourse.id)
        ]);
        const pMap = {};
        (progRes.data || []).forEach(p => {
          pMap[p.moduleId] = { ...(pMap[p.moduleId] || {}), ...p };
        });
        (modProgRes.data || []).forEach(mp => {
          pMap[mp.moduleId] = {
            ...(pMap[mp.moduleId] || {}),
            ...mp,
            videoCompleted: Boolean(mp.videoCompleted),
            lastPosition: mp.lastPosition != null ? mp.lastPosition : mp.lastPositionSeconds
          };
        });
        setStudentProgressMap(pMap);
      }

      // Refresh course data from backend to receive freshly unlocked modules
      if (selectedCourse?.id) {
        const cRes = await getCourseById(selectedCourse.id);
        if (cRes.success && cRes.data) {
          setSelectedCourse(prev => ({ ...prev, ...cRes.data }));
        }
      }
    } catch (err) {
      console.error('Failed to submit assignment:', err);
    } finally {
      setAssessmentSubmitting(false);
    }
  };

  const selectCourseToLearn = async (course) => {
    let fullCourse = course;
    if (course?.id) {
      try {
        const cRes = await getCourseById(course.id);
        if (cRes.success && cRes.data) {
          fullCourse = {
            ...course,
            ...cRes.data,
            batchName: course.batchName || course.batch || cRes.data.batchName || 'Unassigned',
            assignedTrainer: course.assignedTrainer || cRes.data.assignedTrainer || 'Course Trainer'
          };
        }
      } catch (err) {
        console.warn('Failed to fetch full course details:', err);
      }
    }
    setSelectedCourse(fullCourse);
    
    // Check Enrollment Authorization
    const firstModuleId = fullCourse.modules?.[0]?.id;
    if (firstModuleId) {
      const authRes = await authorizeVideoPlayback(studentIdentifier, fullCourse.id, firstModuleId);
      setIsAuthorized(authRes.success);
      setAuthMsg(authRes.message || '');
    } else {
      setIsAuthorized(true);
      setAuthMsg('');
    }

    // Load progress and submissions for this course
    await loadSubmissionsData();
    const [progRes, modProgRes] = await Promise.all([
      getStudentProgress(studentIdentifier, fullCourse.id),
      getStudentModuleProgress(studentIdentifier, fullCourse.id)
    ]);
    const pMap = {};
    (progRes.data || []).forEach(p => {
      pMap[p.moduleId] = { ...(pMap[p.moduleId] || {}), ...p };
    });
    (modProgRes.data || []).forEach(mp => {
      pMap[mp.moduleId] = {
        ...(pMap[mp.moduleId] || {}),
        ...mp,
        videoCompleted: Boolean(mp.videoCompleted),
        lastPosition: mp.lastPosition != null ? mp.lastPosition : mp.lastPositionSeconds
      };
    });
    setStudentProgressMap(pMap);

    const firstMod = fullCourse.modules?.[0];
    setActiveModule(firstMod || null);

    // Default tab based on course mode (Online -> live, Recorded/Hybrid -> recorded)
    const mode = fullCourse.mode || 'Online';
    if (mode === 'Online' || mode === 'Hybrid') {
      setHybridTab('live');
    } else {
      setHybridTab('recorded');
    }

    setActiveTab('learn');
  };

  const isModuleLocked = (index) => {
    if (index === 0) return false; // Module 1 is always unlocked
    if (!modulesList || modulesList.length === 0) return false;
    const mod = modulesList[index];
    if (mod?.locked !== undefined) return Boolean(mod.locked);
    if (mod?.isLocked !== undefined) return Boolean(mod.isLocked);
    const prevMod = modulesList[index - 1];
    if (!prevMod) return false;

    // Check video completion (>= 95% watched)
    const prevProg = studentProgressMap[prevMod.id];
    const prevHasVideo = Boolean(prevMod.videoUrl || prevMod.videoStreamId || prevMod.videoStorageRef);
    const isVideoDone = prevProg?.status === 'Completed' || Boolean(prevProg?.completed) || Boolean(prevProg?.videoCompleted);
    if (prevHasVideo && !isVideoDone) {
      return true;
    }

    // Check assignment submission
    const prevHasAssignment = Boolean(prevMod.assignmentFile || prevMod.assignmentFileUrl || prevMod.assignmentPdf || prevMod.assignmentFileName);
    if (prevHasAssignment) {
      const submitted = studentSubmissions.some(s =>
        (s.sourceId === prevMod.id || (s.assignmentTitle && prevMod.title && s.assignmentTitle.toLowerCase().includes(prevMod.title.toLowerCase())))
      );
      if (!submitted) {
        return true;
      }
    }

    return false;
  };

  const getStudentEnquiryForCourse = (courseId, courseTitle) => {
    return enquiriesList.find(e =>
      (e.email?.toLowerCase() === studentIdentifier.toLowerCase() || e.name?.toLowerCase() === studentName.toLowerCase()) &&
      (e.courseId === courseId || e.course?.toLowerCase() === courseTitle?.toLowerCase())
    );
  };

  const handleEnroll = async (courseOrId) => {
    try {
      const courseObj = typeof courseOrId === 'object' ? courseOrId : availableCourses.find(c => c.id === courseOrId);
      const courseTitle = courseObj?.title || courseObj?.name || 'Course';
      const courseId = courseObj?.id || courseOrId;

      const enquiriesRes = await getMyEnquiries();
      const existingEnquiries = enquiriesRes.data || [];

      const hasPending = existingEnquiries.some(e =>
        (e.email?.toLowerCase() === studentIdentifier.toLowerCase() || e.name?.toLowerCase() === studentName.toLowerCase()) &&
        (e.course?.toLowerCase() === courseTitle.toLowerCase() || e.courseId === courseId) &&
        (e.status === 'New' || e.status === 'Contacted' || e.status === 'Pending')
      );

      if (hasPending) {
        setMsg(`Your request for "${courseTitle}" is currently pending Admin approval.`);
        setTimeout(() => setMsg(''), 4000);
        return;
      }

      await createEnquiry({
        name: studentName,
        email: studentIdentifier,
        phone: user?.phone || '',
        course: courseTitle,
        courseId: courseId,
        message: `LMS Course Enrollment Request for ${courseTitle}`,
        status: 'New'
      });

      setMsg(`Request for "${courseTitle}" submitted successfully! Admin will review your request.`);
      setTimeout(() => setMsg(''), 4000);

      const updatedEnq = await getMyEnquiries();
      setEnquiriesList(updatedEnq.data || []);
    } catch (err) {
      console.error('Enrollment enquiry error:', err);
      setMsg('Failed to submit enrollment request.');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleProgressUpdate = async (moduleId, progressData) => {
    if (!selectedCourse || !moduleId) return;
    setStudentProgressMap(prev => {
      const existing = prev[moduleId] || {};
      const isVidDone = progressData.videoCompleted !== undefined ? Boolean(progressData.videoCompleted) : existing.videoCompleted;
      const isModDone = progressData.moduleCompleted !== undefined ? Boolean(progressData.moduleCompleted) : (existing.status === 'Completed');
      return {
        ...prev,
        [moduleId]: {
          ...existing,
          ...progressData,
          videoCompleted: isVidDone,
          status: isModDone ? 'Completed' : (progressData.watchedSeconds > 0 ? 'In Progress' : (existing.status || 'In Progress'))
        }
      };
    });
  };

  // Live sessions for selected course (Requirement B3: sorted chronologically and locks evaluated)
  const rawLiveSessions = (selectedCourse?.liveSessions && selectedCourse.liveSessions.length > 0)
    ? selectedCourse.liveSessions
    : allSchedules.filter(s => {
        const matchesCourse = (s.course || '').toLowerCase().trim() === (selectedCourse?.title || '').toLowerCase().trim() ||
          (s.courseId && s.courseId === selectedCourse?.id);
        return matchesCourse;
      });

  const courseLiveSessions = evaluateScheduleLocks(rawLiveSessions.map(s => {
    const timeStr = s.time || s.startTime || '05:00 PM - 06:00 PM';
    const parts = timeStr.split('-');
    return {
      ...s,
      id: s.id,
      title: s.title || `${selectedCourse?.title} Live Class`,
      date: s.date || '2026-10-12',
      time: timeStr,
      startTime: parts[0]?.trim() || '05:00 PM',
      endTime: parts[1]?.trim() || '06:00 PM',
      day: s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '',
      trainer: s.trainer || selectedCourse?.assignedTrainer || 'Course Trainer',
      batch: s.batch || selectedCourse?.batchName || 'Unassigned',
      googleMeetUrl: s.meetUrl || s.googleMeetUrl || s.meetLink || '',
      assignmentPdf: s.assignmentPdf || (s.assignmentFileUrl ? { name: s.assignmentFileName || `${s.title} Assignment.pdf`, fileUrl: s.assignmentFileUrl } : null),
      worksheetPdf: s.worksheetPdf || (s.worksheetFileUrl ? { name: s.worksheetFileName || `${s.title} Worksheet.pdf`, fileUrl: s.worksheetFileUrl } : null),
      notesPdf: s.notesPdf || (s.notesFileUrl ? { name: s.notesFileName || `${s.title} Notes.pdf`, fileUrl: s.notesFileUrl } : null),
      locked: s.locked
    };
  }));

  // Calculate overall course progress (Requirement #9)
  const modulesList = [...(selectedCourse?.modules || [])].sort((a, b) => ((a.moduleOrder ?? a.module_order ?? 0) - (b.moduleOrder ?? b.module_order ?? 0)));
  const completedModulesCount = modulesList.filter(m => (studentProgressMap[m.id]?.status === 'Completed')).length;
  const overallProgressPct = modulesList.length > 0 ? Math.round((completedModulesCount / modulesList.length) * 100) : 0;

  if (activeTab === 'learn' && !selectedCourse) {
    return (
      <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <PageLoader message="Opening Classroom..." />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Zoro English Academy LMS
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Student Learning Portal</h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('my-courses')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'my-courses' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Enrolled Courses ({enrolledCourses.length})
          </button>
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'explore' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Available Courses ({availableCourses.length})
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-[#0F52BA] text-xs font-bold rounded-xl">
          {msg}
        </div>
      )}

      {/* MY ENROLLED COURSES TAB */}
      {activeTab === 'my-courses' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Enrolled Courses</h2>
          {loadingData ? (
            <div className="py-12 flex justify-center">
              <PageLoader text="Loading your enrolled courses..." minHeight="min-h-[280px]" />
            </div>
          ) : enrolledCourses.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-4 max-w-md mx-auto">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">You have not enrolled in any courses yet.</p>
              <button
                onClick={() => setActiveTab('explore')}
                className="bg-[#0F52BA] text-white px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
              >
                Browse Available Courses
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map((course) => {
                const modeVal = course.mode || 'Online';
                return (
                  <div key={course.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border border-emerald-200">
                          Enrolled & Active
                        </span>
                        {/* Requirement #12: Mode Badge */}
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                          modeVal === 'Online' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          modeVal === 'Recorded' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {modeVal} MODE
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">{course.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2">{course.description}</p>
                      <div className="text-xs font-semibold text-slate-400">
                        {course.duration || '3 Months'}{course.assignedTrainer ? ` • Trainer: ${course.assignedTrainer}` : ''}
                      </div>
                    </div>

                    <div className="p-5 pt-0 border-t border-slate-100 mt-4 pt-4">
                      <button
                        onClick={() => selectCourseToLearn(course)}
                        className="w-full bg-[#0F52BA] hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Go to Class Room</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EXPLORE COURSES TAB */}
      {activeTab === 'explore' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Explore & Enroll in Courses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map((course) => {
              const isEnrolled = enrolledCourses.some(e => e.id === course.id);
              const modeVal = course.mode || 'Online';
              const enq = getStudentEnquiryForCourse(course.id, course.title);
              const isPending = enq && (enq.status === 'New' || enq.status === 'Contacted' || enq.status === 'Pending');
              const isRejected = enq && enq.status === 'Rejected';

              return (
                <div key={course.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                        Mode: {modeVal}
                      </span>
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        {course.price != null && Number(course.price) > 0 ? `Fee: ₹${Number(course.price).toLocaleString('en-IN')}` : 'Free'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">{course.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{course.description}</p>
                  </div>

                  <div className="p-5 pt-0 border-t border-slate-100 mt-4 pt-4">
                    {isEnrolled ? (
                      <button
                        onClick={() => selectCourseToLearn(course)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Enrolled (Go to Class)</span>
                      </button>
                    ) : isPending ? (
                      <button
                        disabled={true}
                        className="w-full bg-amber-100 text-amber-900 border border-amber-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-not-allowed opacity-80"
                      >
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Request Sent</span>
                      </button>
                    ) : isRejected ? (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Request Again</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Enroll Now</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LEARN PLAYER / CLASSROOM TAB */}
      {activeTab === 'learn' && selectedCourse && (
        <div className="space-y-6">
          
          <button
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                setActiveTab('my-courses');
              }
            }}
            className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Courses</span>
          </button>

          {/* Requirement #12: Course Header & Mode Badge */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase border ${
                  selectedCourse.mode === 'Online' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  selectedCourse.mode === 'Recorded' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                  'bg-amber-100 text-amber-900 border-amber-200'
                }`}>
                  {selectedCourse.mode || 'ONLINE'} MODE
                </span>
                {selectedCourse.assignedTrainer && (
                  <span className="text-xs text-slate-500 font-bold">Trainer: {selectedCourse.assignedTrainer}</span>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">{selectedCourse.title}</h2>
            </div>

            {/* Course Progress Display */}
            {modulesList.length > 0 && (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-right min-w-[200px]">
                <div className="flex justify-between text-xs font-black mb-1">
                  <span className="text-slate-600">Course Progress</span>
                  <span className="text-blue-600">{overallProgressPct}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${overallProgressPct}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-400 font-bold mt-1">
                  {completedModulesCount} / {modulesList.length} Modules Completed
                </div>
              </div>
            )}
          </div>

          {/* CLASSROOM CONTENT NAVIGATION TABS */}
          <div className="flex bg-slate-200/80 p-1 rounded-2xl gap-2 text-xs font-extrabold max-w-md">
            <button
              onClick={() => setHybridTab('recorded')}
              className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                hybridTab === 'recorded' ? 'bg-[#0F52BA] text-white shadow-md' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>RECORDED MODULES ({modulesList.length})</span>
            </button>
            <button
              onClick={() => setHybridTab('live')}
              className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                hybridTab === 'live' ? 'bg-[#0F52BA] text-white shadow-md' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>LIVE SESSIONS ({courseLiveSessions.length})</span>
            </button>
          </div>

          {/* SECTION 1: LIVE SESSIONS TAB */}
          {hybridTab === 'live' && (
            <div className="space-y-4">
              {selectedCourse?.mode === 'Recorded' ? (
                <div className="bg-rose-50 p-8 rounded-3xl border border-rose-200 text-center space-y-3 shadow-xs">
                  <Video className="w-12 h-12 text-rose-500 mx-auto" />
                  <h4 className="text-base font-black text-rose-900">Live session is not available for this course.</h4>
                  <p className="text-xs text-rose-700 font-semibold max-w-md mx-auto">
                    This is a Recorded-only course. Please access your course video lessons under Recorded Modules!
                  </p>
                  <button
                    onClick={() => setHybridTab('recorded')}
                    className="bg-[#0F52BA] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center space-x-2"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Go to Recorded Modules</span>
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Video className="w-5 h-5 text-blue-600" />
                    Scheduled Live Sessions
                  </h3>

                  {courseLiveSessions.length === 0 ? (
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
                      <Video className="w-12 h-12 text-slate-300 mx-auto" />
                      <h4 className="text-base font-black text-slate-800">No Live Classes Scheduled Currently</h4>
                      <p className="text-xs text-slate-500 font-semibold max-w-md mx-auto">
                        There are no live interactive classes scheduled for this course at this moment. You can continue learning with the Recorded Video Modules!
                      </p>
                      <button
                        onClick={() => setHybridTab('recorded')}
                        className="bg-[#0F52BA] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center space-x-2"
                      >
                        <Layers className="w-4 h-4" />
                        <span>Go to Recorded Modules</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {courseLiveSessions.map((session) => {
                        const isLive = session.status === 'LIVE';
                        const isLocked = session.isLocked;

                        return (
                          <div
                            key={session.id}
                            className={`p-6 rounded-3xl border shadow-md space-y-4 flex flex-col justify-between transition-all duration-300 ${
                              isLocked
                                ? 'bg-slate-50/70 border-slate-200/90 text-slate-500'
                                : session.isNearestUpcoming
                                ? 'bg-white border-blue-300 ring-2 ring-blue-500/20'
                                : 'bg-white border-slate-200/80'
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                {isLocked ? (
                                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1.5">
                                    <Lock className="w-3 h-3 text-amber-600" />
                                    <span>{session.unlockLabel || 'LOCKED'}</span>
                                  </span>
                                ) : (
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                                    isLive ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse' :
                                    session.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1' :
                                    'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  }`}>
                                    {isLive ? '🔴 LIVE NOW' : session.status === 'UPCOMING' ? (session.isNearestUpcoming ? 'NEXT SESSION' : 'UPCOMING') : 'COMPLETED'}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-slate-400">{session.day}</span>
                              </div>

                              <h4 className={`text-base font-black ${isLocked ? 'text-slate-700' : 'text-slate-900'}`}>{session.title}</h4>

                              <div className="space-y-1 text-xs text-slate-600 font-semibold">
                                <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-600" /> {session.date}</div>
                                <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-blue-600" /> {session.startTime} - {session.endTime}</div>
                                <div className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" /> Trainer: {session.trainer} • Batch: {session.batch || selectedCourse.batchName || 'Unassigned'}</div>
                              </div>

                              {/* Requirement B3: If locked, hide classroom documents and show unlock note */}
                              {isLocked ? (
                                <div className="pt-2 border-t border-slate-200/60">
                                  <div className="px-3 py-2 bg-white/80 border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Classroom documents unlock 30 minutes before class</span>
                                  </div>
                                </div>
                              ) : (
                                (session.assignmentPdf || session.worksheetPdf || session.notesPdf) && (
                                  <div className="pt-2 border-t border-slate-100 space-y-1">
                                    <div className="text-[10px] font-black text-slate-400 uppercase">Classroom Session Resources</div>
                                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                                      {session.assignmentPdf && (
                                        <button
                                          type="button"
                                          onClick={() => setViewerFile(typeof session.assignmentPdf === 'object' ? session.assignmentPdf : { name: `${session.title} Assignment.pdf`, fileUrl: session.assignmentPdf, type: 'pdf' })}
                                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg font-bold flex items-center space-x-1 cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3 text-purple-600" />
                                          <span>Assignment [View]</span>
                                        </button>
                                      )}
                                      {session.worksheetPdf && (
                                        <button
                                          type="button"
                                          onClick={() => setViewerFile(typeof session.worksheetPdf === 'object' ? session.worksheetPdf : { name: `${session.title} Worksheet.pdf`, fileUrl: session.worksheetPdf, type: 'pdf' })}
                                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg font-bold flex items-center space-x-1 cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3 text-blue-600" />
                                          <span>Worksheet [View]</span>
                                        </button>
                                      )}
                                      {session.notesPdf && (
                                        <button
                                          type="button"
                                          onClick={() => setViewerFile(typeof session.notesPdf === 'object' ? session.notesPdf : { name: `${session.title} Notes.pdf`, fileUrl: session.notesPdf, type: 'pdf' })}
                                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg font-bold flex items-center space-x-1 cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3 text-emerald-600" />
                                          <span>Notes [View]</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>

                            {/* JOIN BUTTON */}
                            {(() => {
                              const joinState = getScheduleJoinState(session);
                              if (!joinState.enabled) {
                                return (
                                  <button
                                    type="button"
                                    disabled
                                    className="w-full py-3 rounded-xl font-bold text-xs text-center flex items-center justify-center space-x-2 bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                                  >
                                    <Lock className="w-4 h-4 text-slate-400" />
                                    <span>{joinState.label}</span>
                                  </button>
                                );
                              }

                              return (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const res = await joinSchedule(session.id);
                                      if (res && res.success && (res.data?.meetUrl || res.meetUrl)) {
                                        const finalUrl = res.data?.meetUrl || res.meetUrl;
                                        window.open(finalUrl, '_blank');
                                      } else {
                                        setMsg(res?.message || 'Could not join session');
                                        setTimeout(() => setMsg(''), 4000);
                                      }
                                    } catch (err) {
                                      setMsg(err?.message || 'Failed to join session');
                                      setTimeout(() => setMsg(''), 4000);
                                    }
                                  }}
                                  className={`w-full py-3 rounded-xl font-black text-xs text-center flex items-center justify-center space-x-2 shadow-md transition-transform transform active:scale-95 cursor-pointer ${
                                    isLive
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-bounce'
                                      : 'bg-[#0F52BA] hover:bg-blue-700 text-white'
                                  }`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  <span>{joinState.label}</span>
                                </button>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SECTION 2: RECORDED MODULES TAB */}
          {hybridTab === 'recorded' && (
            selectedCourse?.mode === 'Online' ? (
              <div className="bg-rose-50 p-8 rounded-3xl border border-rose-200 text-center space-y-3 shadow-xs">
                <Layers className="w-12 h-12 text-rose-500 mx-auto" />
                <h4 className="text-base font-black text-rose-900">Recorded session is not available for this course.</h4>
                <p className="text-xs text-rose-700 font-semibold max-w-md mx-auto">
                  This is an Online-only live course. Please attend your scheduled live interactive classes!
                </p>
                <button
                  onClick={() => setHybridTab('live')}
                  className="bg-[#0F52BA] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center space-x-2"
                >
                  <Video className="w-4 h-4" />
                  <span>Go to Live Sessions</span>
                </button>
              </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Main Player & PDFs (Left 8 Cols) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Requirement #4, #5, #6, #7, #8: SECURE VIDEO PLAYER WITH DYNAMIC WATERMARK */}
                <SecureVideoPlayer
                  videoRefData={playbackData || activeModule?.videoStorageRef}
                  videoTitle={activeModule?.title || selectedCourse.title}
                  courseTitle={selectedCourse.title}
                  poster={activeModule?.thumbnail || activeModule?.thumbnailUrl || null}
                  studentName={studentName}
                  studentEmail={studentIdentifier}
                  isAuthorized={isAuthorized}
                  authErrorMsg={authMsg}
                  initialPosition={studentProgressMap[activeModule?.id]?.lastPosition || 0}
                  moduleId={activeModule?.id}
                  courseId={selectedCourse?.id}
                  onProgressUpdate={(progData) => handleProgressUpdate(activeModule?.id, progData)}
                  onTokenExpired={() => {
                    if (selectedCourse?.id && activeModule?.id && studentIdentifier) {
                      authorizeVideoPlayback(studentIdentifier, selectedCourse.id, activeModule.id).then(res => {
                        if (res.success && res.data) {
                          setIsAuthorized(true);
                          setPlaybackData(res.data);
                        }
                      });
                    }
                  }}
                />

                {/* Module Details & Download PDF Attachments */}
                {activeModule && (
                  <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-4 gap-4">
                      <div className="flex items-start space-x-3">
                        {activeModule.thumbnail && (
                          <div className="w-24 h-18 rounded-2xl overflow-hidden shrink-0 border border-slate-200 bg-slate-100">
                            <img src={resolveFileUrl(activeModule.thumbnail)} alt={activeModule.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-black text-slate-900">{activeModule.title}</h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{activeModule.description}</p>
                        </div>
                      </div>

                      {['Completed', 'In Progress'].includes(studentProgressMap[activeModule.id]?.status) && (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border shrink-0 ${
                          studentProgressMap[activeModule.id]?.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {studentProgressMap[activeModule.id]?.status}
                        </span>
                      )}
                    </div>

                    {/* PDF Resources (Requirement #3, #14) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      {activeModule.notesPdf && (
                        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1 text-xs">
                          <div className="font-extrabold text-emerald-900 flex items-center gap-1">
                            <FileText className="w-4 h-4 text-emerald-600" /> Notes PDF
                          </div>
                          <div className="text-[11px] text-slate-600 font-semibold truncate">{activeModule.notesPdf.name}</div>
                          <div className="flex items-center space-x-3 pt-1">
                            <button onClick={() => setViewerFile(activeModule.notesPdf)} className="text-[10px] text-emerald-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer">
                              <Eye className="w-3 h-3" /> View
                            </button>
                          </div>
                        </div>
                      )}

                      {activeModule.activitySheetPdf && (
                        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 space-y-1 text-xs">
                          <div className="font-extrabold text-blue-900 flex items-center gap-1">
                            <FileText className="w-4 h-4 text-blue-600" /> Activity Sheet
                          </div>
                          <div className="text-[11px] text-slate-600 font-semibold truncate">{activeModule.activitySheetPdf.name}</div>
                          <div className="flex items-center space-x-3 pt-1">
                            <button onClick={() => setViewerFile(activeModule.activitySheetPdf)} className="text-[10px] text-blue-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer">
                              <Eye className="w-3 h-3" /> View
                            </button>
                          </div>
                        </div>
                      )}

                      {activeModule.assignmentPdf && (
                        <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-1 text-xs">
                          <div className="font-extrabold text-purple-900 flex items-center gap-1">
                            <FileText className="w-4 h-4 text-purple-600" /> Assignment PDF
                          </div>
                          <div className="text-[11px] text-slate-600 font-semibold truncate">{activeModule.assignmentPdf.name}</div>
                          <div className="flex items-center space-x-3 pt-1">
                            <button onClick={() => setViewerFile(activeModule.assignmentPdf)} className="text-[10px] text-purple-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer">
                              <Eye className="w-3 h-3" /> View
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* After Session Assessment Section */}
                    {(() => {
                      const currentSub = studentSubmissions.find(s =>
                        s.studentEmail?.toLowerCase() === studentIdentifier.toLowerCase() &&
                        (s.sourceId === activeModule.id || (s.assignmentTitle && activeModule.title && s.assignmentTitle.toLowerCase().includes(activeModule.title.toLowerCase())))
                      );

                      const assignmentDoc = activeModule.assignmentPdf || activeModule.assignmentFile;

                      return assignmentDoc ? (
                        <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-900">Assignment</h4>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {assignmentDoc.name || `${activeModule.title} Assignment`}
                                </p>
                              </div>
                            </div>

                            {currentSub ? (
                              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                                currentSub.status === 'Corrected' || currentSub.status === 'Reviewed'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}>
                                {currentSub.status === 'Corrected' || currentSub.status === 'Reviewed' ? '✓ Corrected' : (isTrainer ? '⏳ Pending Admin Review' : '⏳ Pending Trainer Correction')}
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border bg-purple-100 text-purple-800 border-purple-200">
                                Assignment Active
                              </span>
                            )}
                          </div>

                          {/* ASSIGNMENT TASK UPLOADED FILE TASK */}
                          <div className="space-y-4">
                            {/* Assessment Task Attachment View */}
                            {assignmentDoc.fileUrl && (
                              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-purple-600" />
                                  <span>Task Document: {assignmentDoc.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setViewerFile(assignmentDoc)}
                                    className="text-[11px] font-extrabold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View Task File
                                  </button>
                                </div>
                              </div>
                            )}

                              {/* SUBMISSION RECEIVED / TRAINER RESULT VIEW */}
                              {currentSub ? (
                                <div className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-4 shadow-md">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div>
                                      <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">Submission Details</span>
                                      <h5 className="text-sm font-black text-white">{currentSub.assignmentTitle}</h5>
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-400 font-medium">{formatSubmissionTime(currentSub.submittedAt)}</span>
                                  </div>

                                  {currentSub.attachment && (
                                    <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs">
                                      <span className="font-bold text-slate-200 truncate">📄 {currentSub.attachment.name}</span>
                                      <button
                                        onClick={() => setViewerFile(currentSub.attachment)}
                                        className="text-purple-400 hover:text-purple-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" /> View Submitted File
                                      </button>
                                    </div>
                                  )}

                                  {/* TRAINER FEEDBACK AND MARKS DISPLAY */}
                                  {(currentSub.status === 'Corrected' || currentSub.status === 'Reviewed') ? (
                                    <div className="p-4 bg-emerald-950/70 border border-emerald-700/60 rounded-xl space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-1.5 font-black text-xs text-emerald-300">
                                          <Award className="w-4 h-4 text-emerald-400" />
                                          <span>{isTrainer ? 'Admin Evaluation Result' : 'Trainer Evaluation Result'}</span>
                                        </div>
                                        {currentSub.score && (
                                          <span className="bg-emerald-500 text-slate-950 font-black text-xs px-3 py-1 rounded-lg">
                                            Score: {currentSub.score}
                                          </span>
                                        )}
                                      </div>

                                      {(currentSub.feedback || currentSub.remarks) ? (
                                        <p className="text-xs text-emerald-100 font-semibold leading-relaxed">
                                          "{currentSub.feedback || currentSub.remarks}"
                                        </p>
                                      ) : (
                                        <p className="text-[11px] text-emerald-300/80 font-medium italic">Evaluated by {currentSub.correctedBy || currentSub.reviewer || (isTrainer ? 'Admin' : 'Trainer')}</p>
                                      )}

                                      {currentSub.correctedFileUrl && (
                                        <div className="flex items-center justify-between bg-emerald-900/60 p-2.5 rounded-xl border border-emerald-700/60 text-xs">
                                          <span className="font-bold text-emerald-200 truncate">📄 Corrected Document</span>
                                          <button
                                            type="button"
                                            onClick={() => setViewerFile({ name: 'Corrected Document', url: currentSub.correctedFileUrl, type: 'pdf' })}
                                            className="text-emerald-300 hover:text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                          >
                                            <Eye className="w-3.5 h-3.5" /> View Correction
                                          </button>
                                        </div>
                                      )}
                                      
                                      <div className="text-[10px] font-mono text-emerald-400 text-right pt-1">
                                        Reviewed by {currentSub.correctedBy || currentSub.reviewer || (isTrainer ? 'Admin' : 'Trainer')} on {currentSub.correctedAt || currentSub.updatedAt || ''}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-3.5 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs text-amber-300 font-semibold flex items-center space-x-2">
                                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                      <span>{isTrainer ? 'Your submission is awaiting evaluation by Admin. Marks and feedback will appear here once corrected.' : `Your submission is awaiting evaluation by your assigned trainer (${selectedCourse.assignedTrainer || 'Course Trainer'}). Marks and feedback will appear here once corrected.`}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                /* STUDENT SUBMISSION FORM */
                                <form onSubmit={handleSubmitStudentAssessment} className="p-5 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-4">
                                  <h5 className="text-xs font-black text-purple-950 uppercase tracking-wider">Submit Your Assignment Solution</h5>
                                  
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                      Upload Solution File (PDF, DOCX, MP4 Video, Audio MP3, Image PNG/JPG, etc.) *
                                    </label>
                                    {assessmentFile ? (
                                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs font-bold">
                                        <span>📄 {assessmentFile.name} ({assessmentFile.size})</span>
                                        <button
                                          type="button"
                                          onClick={() => setAssessmentFile(null)}
                                          className="text-rose-600 font-bold hover:underline"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ) : (
                                      <input
                                        type="file"
                                        required
                                        onChange={handleStudentAssessmentUpload}
                                        className="w-full text-xs font-medium bg-white p-2.5 rounded-xl border border-slate-200 cursor-pointer"
                                      />
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Answer Notes / Remarks *</label>
                                    <textarea
                                      rows={2}
                                      required
                                      placeholder="Add your notes or remarks for your trainer..."
                                      value={assessmentNotes}
                                      onChange={(e) => setAssessmentNotes(e.target.value)}
                                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-purple-600"
                                    />
                                  </div>

                                  {(() => {
                                    const hasVideo = Boolean(
                                      activeModule?.videoStorageRef &&
                                      activeModule.videoStorageRef !== 'null' &&
                                      activeModule.videoStorageRef !== '{}' &&
                                      (typeof activeModule.videoStorageRef === 'string' ? activeModule.videoStorageRef.trim().length > 2 : true)
                                    );
                                    const curProg = studentProgressMap[activeModule?.id];
                                    const isVideoCompleted = hasVideo ? Boolean(curProg?.videoCompleted) : true;
                                    const hasFile = Boolean(assessmentFile);
                                    const hasNotes = Boolean(assessmentNotes && assessmentNotes.trim().length > 0);
                                    const isSubmitValid = isVideoCompleted && hasFile && hasNotes;

                                    let hintText = '';
                                    if (!isVideoCompleted) {
                                      hintText = 'Watch the full video to enable submission';
                                    } else if (!hasFile) {
                                      hintText = 'Choose a file to submit assignment solution';
                                    } else if (!hasNotes) {
                                      hintText = 'Add your answer notes/remarks';
                                    }

                                    return (
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <button
                                          type="submit"
                                          disabled={!isSubmitValid || assessmentSubmitting}
                                          className={`font-extrabold px-6 py-2.5 rounded-xl shadow-md text-xs inline-flex items-center space-x-2 transition-all ${
                                            isSubmitValid && !assessmentSubmitting
                                              ? 'bg-purple-700 hover:bg-purple-800 text-white cursor-pointer'
                                              : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                                          }`}
                                        >
                                          <Send className="w-3.5 h-3.5" />
                                          <span>{assessmentSubmitting ? 'Submitting...' : 'Submit Assignment Solution'}</span>
                                        </button>
                                        {!isSubmitValid && (
                                          <span className="text-[11px] text-amber-700 font-semibold italic">
                                            {hintText}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </form>
                              )}

                            </div>

                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              {/* Modules Syllabus Sidebar (Right 4 Cols) */}
              <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                  Course Modules ({modulesList.length})
                </h3>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {modulesList.length === 0 ? (
                    <p className="text-xs text-slate-400 font-semibold italic">No recorded modules created for this course yet.</p>
                  ) : (
                    modulesList.map((mod, index) => {
                      const locked = isModuleLocked(index);
                      const isActive = activeModule?.id === mod.id;
                      const isJustUnlocked = justUnlockedModuleId === mod.id;
                      const prog = studentProgressMap[mod.id];
                      const modStatus = prog?.status || '';

                      return (
                        <button
                          key={mod.id || index}
                          onClick={() => {
                            if (!locked) setActiveModule(mod);
                          }}
                          disabled={locked}
                          className={`w-full text-left p-4 rounded-2xl text-xs font-bold transition-all border space-y-2 ${
                            isJustUnlocked
                              ? 'animate-unlock-card bg-emerald-50 border-emerald-500 text-emerald-950 shadow-md'
                              : locked
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                              : isActive
                              ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm cursor-pointer'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-blue-300 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {(mod.thumbnailUrl || mod.thumbnail) && (
                              <img
                                src={resolveFileUrl(mod.thumbnailUrl || mod.thumbnail)}
                                alt=""
                                className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-black text-sm">Module {index + 1}</span>
                                  {isJustUnlocked ? (
                                    <Unlock className="w-3.5 h-3.5 text-emerald-600 animate-unlock-icon" />
                                  ) : locked ? (
                                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                                  ) : null}
                                </div>
                                {isJustUnlocked ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase bg-emerald-200 text-emerald-900 border-emerald-400">
                                    UNLOCKED!
                                  </span>
                                ) : locked ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase bg-slate-200 text-slate-500 border-slate-300">
                                    LOCKED
                                  </span>
                                ) : modStatus === 'Completed' ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase bg-emerald-100 text-emerald-800 border-emerald-200">
                                    Completed
                                  </span>
                                ) : modStatus === 'In Progress' ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase bg-amber-100 text-amber-800 border-amber-200">
                                    In Progress
                                  </span>
                                ) : null}
                              </div>

                              <div className="text-xs font-bold line-clamp-1 mt-0.5">{mod.title}</div>
                            </div>
                          </div>

                          {locked ? (
                            <div className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 mt-1">
                              <Lock className="w-3 h-3 shrink-0" /> {
                                (modulesList[index - 1]?.assignmentPdf || modulesList[index - 1]?.assignmentFile || modulesList[index - 1]?.assignmentFileUrl)
                                  ? `Complete Module ${index} assignment to unlock`
                                  : `Complete Module ${index} to unlock`
                              }
                            </div>
                          ) : (
                            prog?.completionPercentage > 0 && (
                              <div className="space-y-1 pt-1">
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${prog.completionPercentage}%` }}></div>
                                </div>
                                <div className="text-[10px] text-slate-400 text-right">
                                  {prog.completionPercentage}% watched
                                </div>
                              </div>
                            )
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
            )
          )}

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
