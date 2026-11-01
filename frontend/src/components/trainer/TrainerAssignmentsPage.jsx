import React, { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, AlertTriangle, X, Eye, Users, Layers, Check, Edit, Trash2, FileText } from 'lucide-react';
import { 
  getCreatedAssignments, 
  createExtraAssignment, 
  updateAssignment, 
  deleteAssignment,
  getTrainerAllocatedCourses as fetchTrainerAllocatedCoursesApi,
  getTrainerBatchesForCourse,
  getTrainerStudentsForCourse
} from '../../api/assignmentApi';
import { uploadFile } from '../../api/fileApi';
import { getCourses, getTrainerCourseRequests } from '../../api/courseApi';
import { getBatches } from '../../api/batchApi';
import { getTrainerStudents } from '../../api/userApi';
import { useAuth } from '../../context/AuthContext';
import { getTrainerAllocatedCourses as getTrainerAllocatedCoursesHelper, getTrainerAllocatedBatches, filterStudentsByCourseAndBatch } from '../../utils/trainerFilterHelper';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import UnifiedUploader from '../common/UnifiedUploader';
import { useDialog } from '../../context/DialogContext';

export default function TrainerAssignmentsPage() {
  const { user } = useAuth();
  const { showError, showWarning, confirm } = useDialog();
  const trainerName = user?.name || '';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [allowCreation, setAllowCreation] = useState(true);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);

  const [assignments, setAssignments] = useState([]);
  const [coursesList, setCoursesList] = useState([]);
  const [batchesList, setBatchesList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

  // Modal dependent state
  const [modalBatches, setModalBatches] = useState([]);
  const [modalStudents, setModalStudents] = useState([]);
  const [loadingModalBatches, setLoadingModalBatches] = useState(false);
  const [loadingModalStudents, setLoadingModalStudents] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStudentSelector, setShowStudentSelector] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);
  const [savingAsg, setSavingAsg] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Student selection state inside modal
  const [selectedStudentObjects, setSelectedStudentObjects] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentBatchFilter, setStudentBatchFilter] = useState('All');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    course: '',
    courseId: '',
    targetType: 'batch', // 'batch' | 'student'
    targetBatch: '',
    batchId: '',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    attachmentName: '',
    attachmentUrl: '',
    attachmentType: 'application/pdf',
    attachmentSize: ''
  });

  const loadAllData = async () => {
    try {
      const asgRes = await getCreatedAssignments();
      setAssignments(asgRes?.data || []);

      // Fetch allocated Online/Hybrid courses from backend
      let allocatedCrs = [];
      try {
        if (typeof fetchTrainerAllocatedCoursesApi === 'function') {
          const cRes = await fetchTrainerAllocatedCoursesApi();
          if (cRes && cRes.success && Array.isArray(cRes.data)) {
            allocatedCrs = cRes.data;
          }
        }
      } catch (err) {
        console.warn('Backend trainer allocated courses fetch failed, checking fallback:', err);
      }

      // Fallback if backend returned empty or in mock mode
      if (allocatedCrs.length === 0) {
        try {
          const [cRes, bRes, reqsRes] = await Promise.all([
            getCourses(),
            getBatches(),
            getTrainerCourseRequests()
          ]);
          const allCourses = (cRes?.data || []).filter(c => (c.mode || '').toLowerCase() !== 'recorded');
          const allBatches = bRes?.data || [];
          const approvedReqs = reqsRes?.data || [];
          allocatedCrs = getTrainerAllocatedCoursesHelper(user, allCourses, allBatches, approvedReqs);
        } catch (e) {
          console.error(e);
        }
      }

      setCoursesList(allocatedCrs);

      if (allocatedCrs.length > 0 && !formData.course) {
        const first = allocatedCrs[0];
        setFormData(prev => ({
          ...prev,
          course: first.title || first.name,
          courseId: first.id
        }));
      }

      // Load all batches for top filter bar
      const bRes = await getBatches();
      const allBatches = bRes?.data || [];
      const allocatedBtcs = getTrainerAllocatedBatches(user, 'All', allocatedCrs, allBatches);
      setBatchesList(allocatedBtcs);

      // Students
      const stdRes = await getTrainerStudents();
      const activeStudents = (stdRes?.data || []).filter(s => (s.status || '').toLowerCase() !== 'inactive' && !s.isDeleted);
      setStudentsList(activeStudents);
    } catch (err) {
      console.error('Failed to load assignments page data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  const availableBatches = getTrainerAllocatedBatches(user, selectedCourse, coursesList, batchesList);

  const handleCourseChange = (courseTitle) => {
    setSelectedCourse(courseTitle);
    const newBatches = getTrainerAllocatedBatches(user, courseTitle, coursesList, batchesList);
    const isCurrentBatchValid = newBatches.some(b => (b.name || b.title) === selectedBatch);
    if (!isCurrentBatchValid) {
      setSelectedBatch('All');
    }
  };

  const loadModalBatches = async (courseId, cTitle = '') => {
    setLoadingModalBatches(true);
    try {
      let batches = [];
      if (typeof getTrainerBatchesForCourse === 'function' && courseId) {
        const res = await getTrainerBatchesForCourse(courseId);
        if (res && res.success && Array.isArray(res.data)) {
          batches = res.data;
        }
      }
      if (batches.length === 0) {
        batches = getTrainerAllocatedBatches(user, cTitle || formData.course || 'All', coursesList, batchesList);
      }
      setModalBatches(batches);
      return batches;
    } catch (err) {
      console.error('Failed to load trainer batches for course:', err);
      const fallback = getTrainerAllocatedBatches(user, cTitle || formData.course || 'All', coursesList, batchesList);
      setModalBatches(fallback);
      return fallback;
    } finally {
      setLoadingModalBatches(false);
    }
  };

  const loadModalStudents = async (courseId, batchId = 'All', cTitle = '') => {
    setLoadingModalStudents(true);
    try {
      let students = [];
      if (typeof getTrainerStudentsForCourse === 'function' && courseId) {
        const res = await getTrainerStudentsForCourse(courseId, batchId);
        if (res && res.success && Array.isArray(res.data)) {
          students = res.data;
        }
      }
      if (students.length === 0) {
        students = filterStudentsByCourseAndBatch(studentsList, cTitle || formData.course || 'All', batchId);
      }
      setModalStudents(students);
      return students;
    } catch (err) {
      console.error('Failed to load trainer students for course:', err);
      const fallback = filterStudentsByCourseAndBatch(studentsList, cTitle || formData.course || 'All', batchId);
      setModalStudents(fallback);
      return fallback;
    } finally {
      setLoadingModalStudents(false);
    }
  };

  const handleModalCourseChange = (courseTitle) => {
    const matched = coursesList.find(c => (c.title || c.name) === courseTitle);
    const newCourseId = matched?.id || '';

    // Requirement 6: Reset batch and student selections whenever course changes
    setFormData(prev => ({
      ...prev,
      course: courseTitle,
      courseId: newCourseId,
      targetBatch: '',
      batchId: ''
    }));
    setSelectedStudentObjects([]);
    setStudentSearchTerm('');
    setStudentBatchFilter('All');

    if (newCourseId) {
      loadModalBatches(newCourseId, courseTitle);
      loadModalStudents(newCourseId, 'All', courseTitle);
    } else {
      setModalBatches([]);
      setModalStudents([]);
    }
  };

  const handleFileUploadMock = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFile(file, 'assignment');
      setFormData(prev => ({
        ...prev,
        attachmentName: file.name,
        attachmentUrl: res.url,
        attachmentType: file.type || 'application/octet-stream',
        attachmentSize: `${(file.size / 1024).toFixed(1)} KB`
      }));
    } catch (err) {
      showError(err.message || 'File upload failed', 'Upload Error');
    }
  };

  const toggleStudentSelection = (student) => {
    setSelectedStudentObjects(prev => {
      const exists = prev.some(s => s.id === student.id || s.email === student.email);
      if (exists) {
        return prev.filter(s => s.id !== student.id && s.email !== student.email);
      } else {
        return [...prev, student];
      }
    });
  };

  const handleOpenCreateModal = () => {
    const firstCourse = coursesList.length > 0 ? coursesList[0] : null;
    const firstCourseTitle = firstCourse ? (firstCourse.title || firstCourse.name) : '';
    const firstCourseId = firstCourse ? firstCourse.id : '';

    setFormData({
      title: '',
      description: '',
      course: firstCourseTitle,
      courseId: firstCourseId,
      targetType: 'batch',
      targetBatch: '',
      batchId: '',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      attachmentName: '',
      attachmentUrl: '',
      attachmentType: 'application/pdf',
      attachmentSize: ''
    });
    setEditingAssignmentId(null);
    setSelectedStudentObjects([]);
    setStudentSearchTerm('');
    setStudentBatchFilter('All');
    setShowCreateModal(true);
    setShowPreviewModal(false);

    if (firstCourseId) {
      loadModalBatches(firstCourseId, firstCourseTitle);
      loadModalStudents(firstCourseId, 'All', firstCourseTitle);
    } else {
      setModalBatches([]);
      setModalStudents([]);
    }
  };

  const handleEditAssignment = (item) => {
    setEditingAssignmentId(item.id);
    const matchedCourse = coursesList.find(c => (c.title || c.name) === item.course || c.id === item.courseId);
    const courseId = item.courseId || (matchedCourse ? matchedCourse.id : '');

    setFormData({
      title: item.title || '',
      description: item.description || '',
      course: item.course || (matchedCourse ? matchedCourse.title : ''),
      courseId: courseId,
      targetType: item.targetType || 'batch',
      targetBatch: item.batch || '',
      batchId: item.batchId || '',
      dueDate: item.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      attachmentName: item.attachment?.name || '',
      attachmentUrl: item.attachment?.url || '',
      attachmentType: item.attachment?.type || 'application/pdf',
      attachmentSize: item.attachment?.size || ''
    });

    if (item.targetType === 'student' && Array.isArray(item.targetStudentIds) && item.targetStudentIds.length > 0) {
      const restored = item.targetStudentIds.map((id, idx) => ({
        id,
        name: item.targetStudentNames?.[idx] || id,
        email: item.targetStudentEmails?.[idx] || ''
      }));
      setSelectedStudentObjects(restored);
    } else {
      setSelectedStudentObjects([]);
    }

    setStudentSearchTerm('');
    setStudentBatchFilter('All');
    setShowCreateModal(true);
    setShowPreviewModal(false);

    if (courseId) {
      loadModalBatches(courseId, item.course);
      loadModalStudents(courseId, 'All', item.course);
    }
  };

  const handleDeleteAssignment = async (id) => {
    const isConfirmed = await confirm(
      'Are you sure you want to delete this assignment? Students will no longer be able to submit.',
      'Delete Assignment',
      { confirmText: 'Delete', danger: true }
    );
    if (!isConfirmed) return;
    const res = await deleteAssignment(id);
    if (res.success) {
      setToastMsg('Assignment deleted successfully');
      setTimeout(() => setToastMsg(''), 3000);
      loadAllData();
    }
  };

  const handleFormNextOrSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showWarning('Please enter an assignment title.', 'Title Required');
      return;
    }
    if (!formData.course) {
      showWarning('Please select a course.', 'Course Required');
      return;
    }
    if (formData.targetType === 'batch') {
      if (!formData.batchId && !formData.targetBatch) {
        showWarning('Please select a batch to assign this assignment to.', 'Batch Required');
        return;
      }
    } else if (formData.targetType === 'student') {
      if (selectedStudentObjects.length === 0) {
        showWarning('Please select at least one student when target is Specific Student.', 'Student Required');
        return;
      }
    }
    setShowPreviewModal(true);
  };

  const handleConfirmAssignmentSubmit = async () => {
    setSavingAsg(true);
    try {
      const matchedCourse = coursesList.find(c => (c.title || c.name) === formData.course);
      const courseId = matchedCourse?.id || formData.courseId || null;
      const matchedBatch = modalBatches.find(b => String(b.id) === String(formData.batchId) || (b.name || b.title) === formData.targetBatch);
      const batchId = matchedBatch?.id || formData.batchId || null;
      const batchName = matchedBatch ? (matchedBatch.name || matchedBatch.title) : formData.targetBatch;

      let targetName = batchName;
      let targetStudentEmail = null;
      let targetStudentIds = [];
      let targetStudentNames = [];
      let targetStudentEmails = [];

      if (formData.targetType === 'student') {
        targetStudentIds = selectedStudentObjects.map(s => s.id || s.email);
        targetStudentNames = selectedStudentObjects.map(s => s.name);
        targetStudentEmails = selectedStudentObjects.map(s => s.email);
        targetStudentEmail = targetStudentEmails[0] || null;

        if (selectedStudentObjects.length === 1) {
          targetName = selectedStudentObjects[0].name;
        } else {
          targetName = `${selectedStudentObjects.length} Students (${selectedStudentObjects.map(s => s.name).join(', ')})`;
        }
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        course: formData.course,
        courseId,
        targetType: formData.targetType,
        targetName,
        batch: formData.targetType === 'batch' ? batchName : null,
        batchId: formData.targetType === 'batch' ? batchId : null,
        targetStudentEmail,
        targetStudentIds,
        targetStudentNames,
        targetStudentEmails,
        trainer: trainerName,
        trainerId: user?.id || null,
        createdBy: trainerName,
        creatorRole: 'TRAINER',
        dueDate: formData.dueDate,
        attachment: formData.attachmentName ? {
          name: formData.attachmentName,
          url: formData.attachmentUrl || '',
          type: formData.attachmentType,
          size: formData.attachmentSize || ''
        } : null
      };

      let res;
      if (editingAssignmentId) {
        res = await updateAssignment(editingAssignmentId, payload);
      } else {
        res = await createExtraAssignment(payload);
      }

      if (res && res.success) {
        setToastMsg(editingAssignmentId ? 'Assignment updated successfully!' : 'Extra Assignment created successfully & synced to Admin Portal!');
        setShowPreviewModal(false);
        setShowCreateModal(false);
        setTimeout(() => setToastMsg(''), 3000);
        loadAllData();
      } else {
        showError(res?.message || 'Failed to save assignment', 'Submission Error');
      }
    } catch (err) {
      console.error('Failed to save assignment:', err);
      showError(err.message || 'Failed to save assignment', 'Submission Error');
    } finally {
      setSavingAsg(false);
    }
  };

  // Batches in modal belong to selected course & current trainer
  const modalAvailableBatches = modalBatches.length > 0
    ? modalBatches
    : getTrainerAllocatedBatches(user, formData.course || 'All', coursesList, batchesList);

  const modalFilteredStudents = (modalStudents.length > 0 ? modalStudents : filterStudentsByCourseAndBatch(studentsList, formData.course || 'All', studentBatchFilter))
    .filter(s => (s.name || '').toLowerCase().includes(studentSearchTerm.toLowerCase()));

  const filteredAssignments = assignments.filter(item => {
    const matchesSearch = (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.course || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'All' || item.course === selectedCourse;
    const matchesBatch = selectedBatch === 'All' || item.batch === selectedBatch;
    return matchesSearch && matchesCourse && matchesBatch;
  });

  return (
    <div className="space-y-6 bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      
      {toastMsg && (
        <div className="p-4 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="p-1 hover:bg-emerald-700 rounded-lg">✕</button>
        </div>
      )}

      {!allowCreation && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs font-bold shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>Assignment creation is currently disabled by administrator.</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Extra Assignment</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Upload and assign extra assignments to entire batches, course groups, or specific individual students.</p>
        </div>
        <button 
          disabled={!allowCreation}
          onClick={() => allowCreation && handleOpenCreateModal()}
          className={`inline-flex items-center justify-center gap-2 font-extrabold px-5 py-3 rounded-xl shadow-md text-xs transition-all ${
            allowCreation 
              ? 'bg-[#0F52BA] hover:bg-blue-700 text-white cursor-pointer' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{allowCreation ? 'Create Extra Assignment' : 'Creation Disabled'}</span>
        </button>
      </div>

      {/* Filter and Search Bar (Requirement 6: Course Filter + Dependent Batch Filter) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Course Filter */}
          <div className="flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <select 
              value={selectedCourse} 
              onChange={(e) => handleCourseChange(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="All">All Courses</option>
              {coursesList.map(c => (
                <option key={c.id || c.title} value={c.title}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Dependent Batch Filter */}
          <div className="flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-purple-600" />
            <select 
              value={selectedBatch} 
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="All">All Batches</option>
              {availableBatches.map(b => (
                <option key={b.id || b.name} value={b.name || b.title}>{b.name || b.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search by assignment title or course..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F52BA]/20"
          />
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12">#</th>
                <th className="py-3.5 px-4">Title & Description</th>
                <th className="py-3.5 px-4">Course</th>
                <th className="py-3.5 px-4">Target Audience</th>
                <th className="py-3.5 px-4">Created By</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Attachment / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {filteredAssignments.length > 0 ? (
                filteredAssignments.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-4 px-4">
                      <div className="font-black text-slate-900 text-sm">{item.title}</div>
                      <div className="text-[11px] font-medium text-slate-500 line-clamp-1">{item.description || 'No instructions provided.'}</div>
                    </td>
                    <td className="py-4 px-4 text-blue-900 font-bold">{item.course}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-block max-w-[200px] truncate ${
                        item.targetType === 'student'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : item.targetType === 'course'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {(item.targetName || item.batch || 'Unassigned').replace(/\s*\([^)]*@[^)]*\)/gi, '')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      <div>{item.createdBy || trainerName}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">{item.creatorRole || 'TRAINER'}</div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-bold">{item.dueDate}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {item.attachment && (
                          <button
                            onClick={() => setViewerFile(item.attachment)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] px-2.5 py-1.5 rounded-xl border border-blue-200 inline-flex items-center space-x-1 cursor-pointer"
                            title="View Attachment"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>View</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEditAssignment(item)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[11px] px-2.5 py-1.5 rounded-xl border border-amber-200 inline-flex items-center space-x-1 cursor-pointer"
                          title="Edit Assignment"
                        >
                          <Edit className="w-3.5 h-3.5 text-amber-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(item.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] px-2 py-1.5 rounded-xl border border-rose-200 inline-flex items-center cursor-pointer"
                          title="Delete Assignment"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-medium">
                    No assignments found for the current search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE EXTRA ASSIGNMENT MODAL */}
      {showCreateModal && !showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100 relative max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Extra Assignment</span>
              <h3 className="text-xl font-black text-slate-900">{editingAssignmentId ? 'Edit Assignment' : 'Create New Assignment'}</h3>
              <p className="text-xs text-slate-500 font-semibold">Assign tasks to an entire batch, all students in a course, or specific individual students.</p>
            </div>

            <form onSubmit={handleFormNextOrSubmit} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block mb-1">Assignment Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Speech Transcript & Pronunciation Practice"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1">Instructions / Description</label>
                <textarea
                  rows={2}
                  placeholder="Enter detailed assignment guidelines..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Course dropdown showing ONLY courses allocated to current trainer */}
              <div>
                <label className="block mb-1">Select Course *</label>
                <select
                  value={formData.course}
                  onChange={(e) => handleModalCourseChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                  required
                >
                  {coursesList.map(c => (
                    <option key={c.id || c.title} value={c.title || c.name}>{c.title || c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Only active Online and Hybrid courses assigned to you are available.
                </p>
              </div>

              {/* TARGET AUDIENCE SELECTION */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="block text-slate-900 font-extrabold text-xs">Assign Target Audience *</label>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Assign Target Audience">
                  <button
                    type="button"
                    role="button"
                    onClick={() => setFormData(prev => ({ ...prev, targetType: 'batch' }))}
                    className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      formData.targetType === 'batch'
                        ? 'bg-blue-600 text-white border-blue-600 font-extrabold shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetType"
                      checked={formData.targetType === 'batch'}
                      onChange={() => setFormData(prev => ({ ...prev, targetType: 'batch' }))}
                      className="w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Entire Batch</span>
                  </button>
                  <button
                    type="button"
                    role="button"
                    onClick={() => setFormData(prev => ({ ...prev, targetType: 'student' }))}
                    className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      formData.targetType === 'student'
                        ? 'bg-blue-600 text-white border-blue-600 font-extrabold shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetType"
                      checked={formData.targetType === 'student'}
                      onChange={() => setFormData(prev => ({ ...prev, targetType: 'student' }))}
                      className="w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Specific Student</span>
                  </button>
                </div>

                {formData.targetType === 'batch' && (
                  <div>
                    <label className="block text-[11px] mb-1 text-slate-600 font-bold">
                      Choose Batch for {formData.course} *
                    </label>
                    {loadingModalBatches ? (
                      <div className="py-2 text-xs text-slate-400">Loading batches...</div>
                    ) : modalBatches.length > 0 ? (
                      <select
                        value={formData.batchId || ''}
                        onChange={(e) => {
                          const bId = e.target.value;
                          const matched = modalBatches.find(b => String(b.id) === String(bId));
                          setFormData(prev => ({
                            ...prev,
                            batchId: bId,
                            targetBatch: matched ? (matched.name || matched.title) : ''
                          }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold cursor-pointer"
                        required
                      >
                        <option value="">-- Select Batch --</option>
                        {modalBatches.map(b => (
                          <option key={b.id || b.name} value={b.id}>{b.name || b.title}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2.5 bg-amber-50 text-amber-800 text-[11px] rounded-xl border border-amber-200 font-semibold">
                        No active batches found for this course and trainer.
                      </div>
                    )}
                  </div>
                )}

                {formData.targetType === 'student' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] text-slate-600 font-bold">
                        Select Specific Students ({formData.course}) *
                      </label>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        {selectedStudentObjects.length} Selected
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowStudentSelector(true)}
                      className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl font-bold flex items-center justify-between cursor-pointer transition-colors shadow-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Users className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="truncate">
                          {selectedStudentObjects.length > 0
                            ? selectedStudentObjects.map(s => s.name).join(', ')
                            : 'Click to select students...'}
                        </span>
                      </div>
                      <span className="text-xs text-blue-600 font-extrabold shrink-0 ml-2">Choose Students &rarr;</span>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-700 font-bold text-xs">Attach Reference File (PDF, Image, Video, Audio, Doc, Spreadsheet)</label>
                <UnifiedUploader
                  category="assignment"
                  title={formData.title || 'Assignment Reference'}
                  accept="*/*"
                  onUploadSuccess={(fileData) => {
                    setFormData(prev => ({
                      ...prev,
                      attachmentName: fileData.fileName || fileData.name,
                      attachmentUrl: fileData.fileUrl || fileData.url,
                      attachmentType: fileData.fileType || fileData.type,
                      attachmentSize: fileData.fileSize ? `${(fileData.fileSize / 1024).toFixed(1)} KB` : ''
                    }));
                  }}
                  existingUrl={formData.attachmentUrl}
                  existingFileName={formData.attachmentName}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs shadow-md cursor-pointer"
                >
                  Preview & Confirm &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT SELECTOR MODAL (Requirement 7: Batch filter inside dialog uses ONLY selected Course) */}
      {showStudentSelector && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-base font-black text-slate-900">Select Target Students</h4>
                <p className="text-[11px] text-slate-500 font-semibold">Course: <strong className="text-blue-900">{formData.course}</strong></p>
              </div>
              <button
                onClick={() => setShowStudentSelector(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filters inside modal */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student name..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>

                {/* Batch dropdown ONLY shows batches belonging to formData.course */}
                <select
                  value={studentBatchFilter}
                  onChange={(e) => setStudentBatchFilter(e.target.value)}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="All">All Batches ({formData.course})</option>
                  {modalAvailableBatches.map(b => (
                    <option key={b.id || b.name} value={b.name || b.title}>{b.name || b.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 px-1">
                <span>Selected: <strong className="text-purple-700">{selectedStudentObjects.length}</strong> student(s)</span>
                {selectedStudentObjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStudentObjects([])}
                    className="text-red-600 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Students List (NO EMAIL DISPLAY) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
              {modalFilteredStudents.length > 0 ? (
                modalFilteredStudents.map((std) => {
                  const isChecked = selectedStudentObjects.some(s => s.id === std.id || s.email === std.email);
                  return (
                    <div
                      key={std.id || std.email}
                      onClick={() => toggleStudentSelection(std)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs">{std.name}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">
                            {formData.course} • {std.batch || (std.courseBatches?.find(cb => cb.course === formData.course)?.batch) || 'Unassigned'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                  No active students match your search filter for {formData.course}.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStudentSelector(false)}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl text-xs shadow-md cursor-pointer"
              >
                Apply Selection ({selectedStudentObjects.length} Selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNMENT PREVIEW & CONFIRMATION MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100 relative max-h-[90dvh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Preview & Confirm</span>
              <h3 className="text-xl font-black text-slate-900">Assignment Summary</h3>
              <p className="text-xs text-slate-500 font-semibold">Review details before sending to target audience.</p>
            </div>

            <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs text-slate-700">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Title</span>
                <div className="font-black text-slate-900 text-sm">{formData.title}</div>
              </div>

              {formData.description && (
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Instructions</span>
                  <div className="font-medium text-slate-600 line-clamp-3">{formData.description}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Course</span>
                  <div className="font-bold text-blue-900">{formData.course}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Due Date</span>
                  <div className="font-bold text-slate-900">{formData.dueDate}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Target Audience</span>
                <div className="font-extrabold text-purple-900 mt-0.5">
                  {formData.targetType === 'batch' && `Entire Batch: ${formData.targetBatch}`}
                  {formData.targetType === 'student' && (
                    <span>
                      Specific Students ({selectedStudentObjects.length}): {selectedStudentObjects.map(s => s.name).join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {formData.attachmentName && (
                <div className="pt-2 border-t border-slate-200/80 flex items-center space-x-2 text-blue-700 font-bold">
                  <FileText className="w-4 h-4" />
                  <span>Attachment: {formData.attachmentName} ({formData.attachmentSize})</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                &larr; Back to Edit
              </button>
              <button
                type="button"
                disabled={savingAsg}
                onClick={handleConfirmAssignmentSubmit}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md cursor-pointer"
              >
                {savingAsg ? 'Assigning...' : 'Confirm & Assign Now'}
              </button>
            </div>
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
