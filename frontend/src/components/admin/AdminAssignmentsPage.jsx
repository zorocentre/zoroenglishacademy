import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, CheckCircle2, Clock, Trash2, Edit2, X, 
  UserCheck, Layers, Eye, User, Award, Check, Filter, Send, Download, BookOpen
} from 'lucide-react';
import { getSubmissions, updateCorrection, assignRecordedSubmissionsToTrainer, getCreatedAssignments } from '../../api/assignmentApi';
import { getBatches } from '../../api/batchApi';
import { getTrainers } from '../../api/userApi';
import { getCourses, updateCourse } from '../../api/courseApi';
import ConfirmModal from '../common/ConfirmModal';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import { formatSubmissionTime } from '../../utils/dateFormatter';

export default function AdminAssignmentsPage() {
  const [activeTab, setActiveTab] = useState('Online'); // 'Online' | 'Recorded' | 'Hybrid' | 'TrainerCreated'
  const [submissions, setSubmissions] = useState([]);
  const [createdAssignments, setCreatedAssignments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerFile, setViewerFile] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('All');

  const [correctingSub, setCorrectingSub] = useState(null);
  const [correctionRemarks, setCorrectionRemarks] = useState('');
  const [correctionScore, setCorrectionScore] = useState('');
  const [correctionStatus, setCorrectionStatus] = useState('Corrected');
  const [savingCorrection, setSavingCorrection] = useState(false);

  const [assignModalBatch, setAssignModalBatch] = useState(null);
  const [assignModalCourse, setAssignModalCourse] = useState(null);
  const [selectedTrainerToAssign, setSelectedTrainerToAssign] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [courses, setCourses] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, crAsgRes, bRes, trRes, cRes] = await Promise.all([
        getSubmissions(),
        getCreatedAssignments(),
        getBatches(),
        getTrainers(),
        getCourses()
      ]);
      setSubmissions(subRes.data || []);
      setCreatedAssignments(crAsgRes.data || []);
      setBatches(bRes.data || []);
      setCourses(cRes.data || []);
      const trList = trRes.data || [];
      setTrainers(trList);
      if (trList.length > 0) setSelectedTrainerToAssign(trList[0].name);
    } catch (err) {
      console.error('Failed to load assignment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCorrection = async (e) => {
    e.preventDefault();
    if (!correctingSub) return;
    setSavingCorrection(true);
    await updateCorrection(correctingSub.id, {
      remarks: correctionRemarks,
      score: correctionScore,
      status: correctionStatus,
      correctedBy: 'Admin'
    });
    setSavingCorrection(false);
    setCorrectingSub(null);
    setCorrectionRemarks('');
    setCorrectionScore('');
    loadData();
  };

  const handleSaveAssignTrainer = async (e) => {
    e.preventDefault();
    if (!assignModalBatch || !selectedTrainerToAssign) return;
    setSavingAssignment(true);
    await assignRecordedSubmissionsToTrainer(assignModalBatch, null, selectedTrainerToAssign);
    setSavingAssignment(false);
    setAssignModalBatch(null);
    loadData();
  };

  const handleSaveAssignCourseTrainer = async (e) => {
    e.preventDefault();
    if (!assignModalCourse || !selectedTrainerToAssign) return;
    setSavingAssignment(true);
    try {
      const selectedTrainerObj = trainers.find(t => t.name === selectedTrainerToAssign || t.id === selectedTrainerToAssign);
      if (assignModalCourse.id) {
        await updateCourse(assignModalCourse.id, {
          ...assignModalCourse,
          trainerId: selectedTrainerObj?.id || null,
          assignedTrainer: selectedTrainerObj?.name || selectedTrainerToAssign,
          assignedTrainerId: selectedTrainerObj?.id || null
        });
      }
      await assignRecordedSubmissionsToTrainer(null, assignModalCourse.id || null, selectedTrainerObj?.name || selectedTrainerToAssign);
    } catch (err) {
      console.error('Failed to assign trainer to recorded course:', err);
    } finally {
      setSavingAssignment(false);
      setAssignModalCourse(null);
      loadData();
    }
  };

  // Filter submissions by Active Mode Tab
  const tabFilteredSubs = submissions.filter(s => {
    if (activeTab === 'Online') return s.mode === 'Online';
    if (activeTab === 'Recorded') return s.mode === 'Recorded';
    if (activeTab === 'Hybrid') return s.mode === 'Hybrid';
    return true;
  });

  // Apply search & batch/course filter
  const finalFilteredSubs = tabFilteredSubs.filter(s => {
    if (activeTab === 'Recorded') {
      if (selectedBatchFilter !== 'All' && s.courseTitle !== selectedBatchFilter && s.courseId !== selectedBatchFilter) return false;
    } else {
      if (selectedBatchFilter !== 'All' && s.batchName !== selectedBatchFilter && s.batchId !== selectedBatchFilter) return false;
    }
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (s.studentName && s.studentName.toLowerCase().includes(q)) ||
      (s.assignmentTitle && s.assignmentTitle.toLowerCase().includes(q)) ||
      (s.courseTitle && s.courseTitle.toLowerCase().includes(q)) ||
      (s.batchName && s.batchName.toLowerCase().includes(q))
    );
  });

  // Group submissions: by Course for Recorded, by Batch for Online/Hybrid
  const groupedData = activeTab === 'Recorded'
    ? finalFilteredSubs.reduce((acc, sub) => {
        const courseKey = sub.courseTitle || 'Recorded Course';
        if (!acc[courseKey]) acc[courseKey] = [];
        acc[courseKey].push(sub);
        return acc;
      }, {})
    : finalFilteredSubs.reduce((acc, sub) => {
        const batch = sub.batchName || 'General Batch';
        if (!acc[batch]) acc[batch] = [];
        acc[batch].push(sub);
        return acc;
      }, {});

  const uniqueBatches = Array.from(new Set(submissions.map(s => s.batchName).filter(Boolean)));
  const uniqueCourses = Array.from(new Set(submissions.filter(s => s.mode === 'Recorded').map(s => s.courseTitle).filter(Boolean)));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-800 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            <span>Assignment Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Student Assignments & Submissions
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            Batch-wise & student-wise submission tracking, correction workflow, and trainer assignment.
          </p>
        </div>
      </div>

      {/* TOP SWITCHING TABS: Online, Recorded, Hybrid, Trainer-Created */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
        {[
          { id: 'Online', label: 'Online Assignments', count: submissions.filter(s => s.mode === 'Online').length },
          { id: 'Recorded', label: 'Recorded Assignments', count: submissions.filter(s => s.mode === 'Recorded').length },
          { id: 'Hybrid', label: 'Hybrid Assignments', count: submissions.filter(s => s.mode === 'Hybrid').length },
          { id: 'TrainerCreated', label: 'Trainer-Created Assignments', count: createdAssignments.length }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedBatchFilter('All');
              }}
              className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                isActive ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab} assignments by student, title, or course...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <select
          value={selectedBatchFilter}
          onChange={(e) => setSelectedBatchFilter(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
        >
          {activeTab === 'Recorded' ? (
            <>
              <option value="All">All Courses</option>
              {uniqueCourses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </>
          ) : (
            <>
              <option value="All">All Batches</option>
              {uniqueBatches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Main Content: Batch-wise Grouped Submissions or Trainer-Created Assignments */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs font-bold text-slate-400">
          Loading assignment data...
        </div>
      ) : activeTab === 'TrainerCreated' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden p-6 space-y-4">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-sm border border-purple-200/60">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Trainer-Created Extra Assignments</h2>
              <p className="text-xs text-slate-500 font-semibold">Central log of all extra assignments created by trainers for batches, courses, or individual students.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Title & Description</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Target Audience</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Attachment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {createdAssignments.length > 0 ? (
                  createdAssignments.map((asg) => (
                    <tr key={asg.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-black text-slate-900">
                        <div>{asg.title}</div>
                        <div className="text-[11px] font-medium text-slate-500 line-clamp-1">{asg.description || 'No detailed instructions.'}</div>
                      </td>
                      <td className="py-4 px-4 text-blue-900 font-bold">{asg.course}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                          asg.targetType === 'student'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : asg.targetType === 'course'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {asg.targetName || asg.batch || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800">{asg.createdBy || 'Trainer'}</td>
                      <td className="py-4 px-4 text-purple-700 font-mono text-[10px] uppercase font-bold">{asg.creatorRole || 'TRAINER'}</td>
                      <td className="py-4 px-4 text-slate-500">{asg.createdAt || '2026-09-24'}</td>
                      <td className="py-4 px-4 font-bold text-slate-800">{asg.dueDate}</td>
                      <td className="py-4 px-4 text-right">
                        {asg.attachment ? (
                          <button
                            onClick={() => setViewerFile(asg.attachment)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] px-3.5 py-1.5 rounded-xl border border-blue-200 inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>View Attachment</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No file</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      No trainer-created extra assignments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : Object.keys(groupedData).length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-800">No {activeTab} Submissions Found</h3>
          <p className="text-xs text-slate-500 font-medium">
            No student assignment submissions exist under {activeTab} mode for the selected filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedData).map(([groupName, subList]) => {
            const isRecorded = activeTab === 'Recorded';
            const courseObj = isRecorded 
              ? courses.find(c => (c.title && c.title.toLowerCase().trim() === groupName.toLowerCase().trim()) || (c.id && (subList[0]?.courseId === c.id || subList[0]?.course === c.title)))
              : null;
            const hasTrainer = Boolean(
              courseObj?.assignedTrainer && 
              courseObj.assignedTrainer !== 'None (Self-Paced)' && 
              courseObj.assignedTrainer !== 'Unassigned'
            );

            return (
              <div key={groupName} className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden space-y-4 p-6">
                
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm border border-blue-200/60">
                      {isRecorded ? <BookOpen className="w-5 h-5 text-purple-600" /> : <Layers className="w-5 h-5" />}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">{groupName}</h2>
                      <p className="text-xs text-slate-500 font-semibold">
                        {subList.length} Student Submissions ({isRecorded ? 'Recorded Course' : `${activeTab} Mode`})
                      </p>
                    </div>
                  </div>

                  {/* RECORDED TAB: ASSIGNED TRAINER DISPLAY AND ASSIGN BUTTON */}
                  {isRecorded ? (
                    <div className="flex items-center gap-2">
                      {hasTrainer ? (
                        <>
                          <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-xl border border-purple-200 font-extrabold text-xs inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            <span>Trainer: {courseObj.assignedTrainer}</span>
                          </span>
                          <button
                            onClick={() => {
                              setAssignModalCourse(courseObj);
                              if (trainers.length > 0) setSelectedTrainerToAssign(trainers[0].name);
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            Change Trainer
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl border border-slate-200 font-extrabold text-xs">
                            Unassigned (Admin Managed)
                          </span>
                          <button
                            onClick={() => {
                              setAssignModalCourse(courseObj || { title: groupName, id: subList[0]?.courseId });
                              if (trainers.length > 0) setSelectedTrainerToAssign(trainers[0].name);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Assign Trainer</span>
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAssignModalBatch(groupName);
                        if (trainers.length > 0) setSelectedTrainerToAssign(trainers[0].name);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-xs flex items-center space-x-2 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Assign Batch to Trainer</span>
                    </button>
                  )}
                </div>

              {/* Student Submissions List for this Batch */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Assignment / Course</th>
                      <th className="py-3 px-4">Submitted On</th>
                      <th className="py-3 px-4">Submission File</th>
                      <th className="py-3 px-4">Assigned Trainer</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                    {subList.map((sub) => {
                      const isCorrected = sub.status === 'Corrected';
                      const subFile = sub.attachment || (sub.fileUrl || sub.fileName ? { name: sub.fileName || 'Submission_File', url: sub.fileUrl, type: sub.fileType, size: sub.fileSize } : null);

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-4 font-bold text-slate-900">
                            <div>{sub.studentName}</div>
                            <div className="text-[11px] font-medium text-slate-400">{sub.studentEmail}</div>
                          </td>
                          <td className="py-4 px-4 text-slate-800 font-bold">
                            <div>{sub.assignmentTitle}</div>
                            <div className="text-[11px] font-medium text-blue-600">{sub.courseTitle}</div>
                          </td>
                          <td className="py-4 px-4 text-slate-500 font-medium">{formatSubmissionTime(sub.submittedAt)}</td>
                          <td className="py-4 px-4">
                            {subFile ? (
                              <button
                                onClick={() => setViewerFile(subFile)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] px-3 py-1 rounded-xl border border-blue-200 inline-flex items-center space-x-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                <span className="truncate max-w-[120px]">{subFile.name || 'View File'}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Text Only</span>
                            )}
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-700">
                            {sub.assignedTrainer ? (
                              <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-200/60 inline-flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{sub.assignedTrainer}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal italic">Admin Review</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              isCorrected
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {sub.status}
                            </span>
                            {sub.score && (
                              <div className="text-[10px] font-black text-emerald-700 mt-0.5">Score: {sub.score}</div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => {
                                setCorrectingSub(sub);
                                setCorrectionRemarks(sub.remarks || '');
                                setCorrectionScore(sub.score || sub.marks || '');
                                setCorrectionStatus(sub.status || 'Corrected');
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                            >
                              {isCorrected ? 'View / Edit Feedback' : 'Review & Correct'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Review & Correct Modal */}
      {correctingSub && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setCorrectingSub(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Review & Correct Submission</span>
              <h3 className="text-xl font-black text-slate-900">{correctingSub.assignmentTitle}</h3>
              <p className="text-xs text-slate-500 font-semibold">Course: {correctingSub.courseTitle}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div><span className="font-bold text-slate-500">Student:</span> <span className="font-black text-slate-900">{correctingSub.studentName}</span></div>
                <div><span className="font-bold text-slate-500">Submitted On:</span> <span className="font-semibold">{formatSubmissionTime(correctingSub.submittedAt)}</span></div>
              </div>

              {/* Submission File Attachment */}
              {(correctingSub.attachment || correctingSub.fileUrl || correctingSub.fileName) && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5 truncate">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate">{correctingSub.attachment?.name || correctingSub.fileName || 'Student Submission File'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      {correctingSub.attachment?.size || 'Standard Size'} • {(correctingSub.attachment?.type || correctingSub.fileType || 'FILE').toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewerFile(correctingSub.attachment || { name: correctingSub.fileName || 'Submission_File', url: correctingSub.fileUrl, type: correctingSub.fileType })}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs inline-flex items-center space-x-1 cursor-pointer shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Submission</span>
                  </button>
                </div>
              )}

              {/* Student Response Text */}
              <div>
                <div className="font-extrabold text-slate-700 mb-1">Student Response / Answer Text:</div>
                <p className="text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  "{correctingSub.answerText || 'No additional submission text.'}"
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marks / Score</label>
                  <input
                    type="text"
                    placeholder="e.g. 95/100 or Grade A"
                    value={correctionScore}
                    onChange={(e) => setCorrectionScore(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correction Status *</label>
                  <select
                    value={correctionStatus}
                    onChange={(e) => setCorrectionStatus(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
                  >
                    <option value="Pending Correction">Pending Correction</option>
                    <option value="Corrected">Reviewed / Corrected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trainer / Admin Remarks & Feedback *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter evaluation remarks, corrections, or grade feedback..."
                  value={correctionRemarks}
                  onChange={(e) => setCorrectionRemarks(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectingSub(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCorrection}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md cursor-pointer"
                >
                  {savingCorrection ? 'Saving...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Recorded Batch to Trainer Modal */}
      {assignModalBatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100 relative max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setAssignModalBatch(null)}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Assign Recorded Corrections</span>
              <h3 className="text-xl font-black text-slate-900">Assign {assignModalBatch} to Trainer</h3>
              <p className="text-xs text-slate-500 font-semibold">Select a trainer to delegate evaluation of recorded module assignments for this batch.</p>
            </div>

            <form onSubmit={handleSaveAssignTrainer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Trainer *</label>
                <select
                  value={selectedTrainerToAssign}
                  onChange={(e) => setSelectedTrainerToAssign(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                >
                  {trainers.map(t => (
                    <option key={t.id || t.name} value={t.name}>{t.name} ({t.role || 'Trainer'})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalBatch(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl text-xs shadow-md"
                >
                  {savingAssignment ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Recorded Course to Trainer Modal */}
      {assignModalCourse && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100 relative max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setAssignModalCourse(null)}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Assign Course Trainer</span>
              <h3 className="text-xl font-black text-slate-900">Assign {assignModalCourse.title}</h3>
              <p className="text-xs text-slate-500 font-semibold">Select a trainer to delegate evaluation and doubts for this recorded course.</p>
            </div>

            <form onSubmit={handleSaveAssignCourseTrainer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Trainer *</label>
                <select
                  value={selectedTrainerToAssign}
                  onChange={(e) => setSelectedTrainerToAssign(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                >
                  {trainers.map(t => (
                    <option key={t.id || t.name} value={t.name}>{t.name} ({t.specialty || t.role || 'Trainer'})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalCourse(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl text-xs shadow-md cursor-pointer"
                >
                  {savingAssignment ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIVERSAL FILE VIEWER MODAL */}
      <UniversalFileViewerModal
        isOpen={Boolean(viewerFile)}
        onClose={() => setViewerFile(null)}
        file={viewerFile}
        hideDownload={true}
      />

    </div>
  );
}
