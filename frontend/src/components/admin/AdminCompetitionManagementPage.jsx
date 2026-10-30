import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Trophy, Users, BookOpen, Video, FileText, Layers, Plus, 
  Trash2, Edit, CheckCircle2, Clock, 
  Upload, Check, Search, Download, Copy, X,
  ChevronUp, ChevronDown, Eye, BarChart2, Award, Volume2, RefreshCw, AlertCircle
} from 'lucide-react';
import { 
  getCompetitions,
  getCompetitionOverview,
  getCompetitionRegisteredStudents,
  getCompetitionSets, assignTrainerToSet, 
  getCompetitionSyllabus, saveCompetitionSyllabus, deleteCompetitionSyllabus,
  getCompetitionGuidanceVideos, saveCompetitionGuidanceVideo, deleteCompetitionGuidanceVideo,
  reorderCompetitionGuidanceVideos,
  getCompetitionStudyMaterials, saveCompetitionStudyMaterial, deleteCompetitionStudyMaterial,
  getCompetitionAssessments, updateCompetitionAssessment, publishCompetitionAssessment,
  republishCompetitionAssessment, getAssessmentRepublishInfo,
  getAssessmentQuestions, saveAssessmentQuestion, deleteAssessmentQuestion,
  duplicateAssessmentQuestion, reorderAssessmentQuestions
} from '../../api/competitionApi';
import { getTrainers } from '../../api/userApi';
import { uploadFile, resolveFileUrl, openFileWithSignedLink, getFileLink } from '../../api/fileApi';
import ButtonSpinner from '../common/ButtonSpinner';
import InlineSpinner from '../common/InlineSpinner';
import PageLoader from '../common/PageLoader';
import UnifiedUploader from '../common/UnifiedUploader';
import SafeVideo from '../common/SafeVideo';
import AudioPromptPlayer from '../common/AudioPromptPlayer';
import GuidanceVideoManager from './GuidanceVideoManager';
import QuestionPreview from '../common/QuestionPreview';
import { useDialog } from '../../context/DialogContext';
import { formatDate, toIstDatetimeInput, istInputToUtcIso } from '../../utils/dateFormatter';

const toLocalDatetimeInput = (isoStr) => toIstDatetimeInput(isoStr);
const toUtcIsoString = (localDtStr) => istInputToUtcIso(localDtStr);

export default function AdminCompetitionManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSuccess, showError, showWarning, confirm } = useDialog();

  const [competitions, setCompetitions] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState(searchParams.get('comp') || '');
  const [loadingCompetitions, setLoadingCompetitions] = useState(true);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState('overview');

  // Sub-tab data states
  const [overviewData, setOverviewData] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [setFilter, setSetFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const [trainers, setTrainers] = useState([]);
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);

  const [syllabus, setSyllabus] = useState(null);
  const [sylTitle, setSylTitle] = useState('Official Competition Syllabus');
  const [sylUploading, setSylUploading] = useState(false);
  const [inlineSyllabusUrl, setInlineSyllabusUrl] = useState('');
  const [inlineSyllabusText, setInlineSyllabusText] = useState('');

  useEffect(() => {
    let active = true;
    if (!syllabus) {
      setInlineSyllabusUrl('');
      setInlineSyllabusText('');
      return;
    }
    const fileId = syllabus.storedFileId || syllabus.id;
    const rawUrl = syllabus.viewUrl || (fileId ? `/api/files/${fileId}` : '');
    const ext = (syllabus.fileType || syllabus.fileName?.split('.').pop() || '').toLowerCase();

    if (fileId) {
      getFileLink(fileId)
        .then(res => {
          if (!active) return;
          const finalUrl = res?.url ? resolveFileUrl(res.url) : resolveFileUrl(rawUrl);
          setInlineSyllabusUrl(finalUrl);
          if (ext === 'txt') {
            fetch(finalUrl)
              .then(r => r.text())
              .then(txt => { if (active) setInlineSyllabusText(txt); })
              .catch(() => {});
          }
        })
        .catch(() => {
          if (active) setInlineSyllabusUrl(resolveFileUrl(rawUrl));
        });
    } else if (rawUrl) {
      setInlineSyllabusUrl(resolveFileUrl(rawUrl));
    }
    return () => { active = false; };
  }, [syllabus]);

  const [videos, setVideos] = useState([]);
  const [newVideo, setNewVideo] = useState({ title: '', bunnyVideoId: '', duration: '', sortOrder: 0 });
  const [savingVideo, setSavingVideo] = useState(false);
  const [previewingVideo, setPreviewingVideo] = useState(null);
  const [reorderingVideos, setReorderingVideos] = useState(false);

  const [materials, setMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({ title: '', sortOrder: 0 });
  const [materialUploading, setMaterialUploading] = useState(false);

  const [assessments, setAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Slot Edit Modal
  const [editingSlot, setEditingSlot] = useState(null);
  const [slotFormData, setSlotFormData] = useState({ title: '', durationMinutes: 20, totalMarks: 20, startAt: '', endAt: '' });
  const [savingSlot, setSavingSlot] = useState(false);

  // Question Builder state
  const [activeAsmtForQuestions, setActiveAsmtForQuestions] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [questionFormData, setQuestionFormData] = useState({
    id: null,
    questionFormat: 'MCQ',
    questionText: '',
    mediaRef: '',
    answerFormat: 'MCQ_OPTIONS',
    guidanceText: '',
    maxDurationSeconds: 120,
    marks: 1,
    sortOrder: 0,
    explanation: '',
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    evaluationCriteria: [
      { title: 'Fluency & Pronunciation', maxMarks: 5 },
      { title: 'Grammar & Vocabulary', maxMarks: 5 }
    ]
  });
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [isMediaUploading, setIsMediaUploading] = useState(false);
  const [attemptCountForEditor, setAttemptCountForEditor] = useState(0);


  // Republish Confirm Modal State (Task K7)
  const isRepublishingRef = useRef(false);
  const [republishModalData, setRepublishModalData] = useState({
    open: false,
    assessment: null,
    attemptCount: 0,
    understand: false,
    loading: false
  });

  // Load competitions on mount
  useEffect(() => {
    loadCompetitionsList();
  }, []);

  const loadCompetitionsList = async () => {
    setLoadingCompetitions(true);
    try {
      const res = await getCompetitions();
      const list = res?.data || [];
      setCompetitions(list);
      if (list.length > 0) {
        const initialId = searchParams.get('comp') || list[0].id;
        setSelectedCompId(initialId);
      }
    } catch (err) {
      console.error('Failed to load competitions:', err);
    } finally {
      setLoadingCompetitions(false);
    }
  };

  const selectedCompetition = useMemo(() => {
    return competitions.find(c => c.id === selectedCompId) || competitions[0] || null;
  }, [competitions, selectedCompId]);

  // Load data when selected competition or tab changes
  useEffect(() => {
    if (!selectedCompetition?.id) return;
    loadTabData(activeTab, selectedCompetition.id);
  }, [selectedCompetition?.id, activeTab]);

  const loadTabData = async (tab, compId) => {
    if (tab === 'overview') {
      setLoadingOverview(true);
      try {
        const res = await getCompetitionOverview(compId);
        setOverviewData(res?.data || null);
      } catch (err) {
        console.error('Failed loading overview:', err);
      } finally {
        setLoadingOverview(false);
      }
    } else if (tab === 'students') {
      setLoadingStudents(true);
      try {
        const res = await getCompetitionRegisteredStudents(compId);
        setStudents(res?.data || []);
      } catch (err) {
        console.error('Failed loading registered students:', err);
      } finally {
        setLoadingStudents(false);
      }
    } else if (tab === 'sets') {
      setLoadingSets(true);
      try {
        const [tRes, sRes] = await Promise.all([getTrainers(), getCompetitionSets(compId)]);
        setTrainers(tRes?.data || []);
        setSets(sRes?.data || []);
      } catch (err) {
        console.error('Failed loading sets:', err);
      } finally {
        setLoadingSets(false);
      }
    } else if (tab === 'syllabus') {
      try {
        const sylRes = await getCompetitionSyllabus(compId);
        setSyllabus(sylRes?.data || null);
        if (sylRes?.data?.title) setSylTitle(sylRes.data.title);
      } catch (err) {
        console.error('Failed loading syllabus:', err);
      }
    } else if (tab === 'videos') {
      try {
        const vRes = await getCompetitionGuidanceVideos(compId);
        setVideos(vRes?.data || []);
      } catch (err) {
        console.error('Failed loading guidance videos:', err);
      }
    } else if (tab === 'materials') {
      try {
        const mRes = await getCompetitionStudyMaterials(compId);
        setMaterials(mRes?.data || []);
      } catch (err) {
        console.error('Failed loading study materials:', err);
      }
    } else if (['test-series', 'mock-tests', 'final-assessment', 'evaluations', 'leaderboard'].includes(tab)) {
      setLoadingAssessments(true);
      try {
        const aRes = await getCompetitionAssessments(compId);
        setAssessments(aRes?.data || []);
      } catch (err) {
        console.error('Failed loading assessments:', err);
      } finally {
        setLoadingAssessments(false);
      }
    }
  };

  const handleCompetitionSwitch = (compId) => {
    setSelectedCompId(compId);
    setSearchParams({ comp: compId });
  };

  // --- Sets Assignment ---
  const handleAssignTrainer = async (setCode, trainerId) => {
    try {
      const res = await assignTrainerToSet(selectedCompetition.id, setCode, trainerId);
      if (res && res.success) {
        await showSuccess(`Trainer assigned to Set ${setCode}`);
        loadTabData('sets', selectedCompetition.id);
      } else {
        await showError(res?.message || 'Assignment failed');
      }
    } catch (err) {
      await showError(err.message || 'Assignment failed');
    }
  };

  // --- Syllabus Handlers ---
  const handleSyllabusUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isDoc = lowerName.endsWith('.pdf') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx') || lowerName.endsWith('.txt');
    if (!isDoc) {
      showWarning('Official Syllabus must be a document (PDF, DOC/DOCX, or TXT). Media files are rejected.', 'Invalid File Type');
      return;
    }

    setSylUploading(true);
    try {
      const uploadRes = await uploadFile(file, 'competition-syllabus');
      const storedId = uploadRes.fileId || uploadRes.id;
      const fileExt = lowerName.split('.').pop();
      const saveRes = await saveCompetitionSyllabus(selectedCompetition.id, {
        title: sylTitle || file.name,
        storedFileId: storedId,
        fileType: fileExt
      });
      if (saveRes && saveRes.success) {
        await showSuccess('Competition syllabus uploaded successfully.');
        loadTabData('syllabus', selectedCompetition.id);
      } else {
        await showError(saveRes?.message || 'Failed to save syllabus record');
      }
    } catch (err) {
      await showError(err.message || 'Syllabus upload failed');
    } finally {
      setSylUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteSyllabus = async () => {
    try {
      const res = await deleteCompetitionSyllabus(selectedCompetition.id);
      if (res && res.success) {
        await showSuccess('Syllabus deleted successfully.');
        setSyllabus(null);
      } else {
        await showError(res?.message || 'Failed to delete syllabus');
      }
    } catch (err) {
      await showError(err.message || 'Failed to delete syllabus');
    }
  };

  // --- Guidance Video Handlers ---
  const handleSaveVideo = async (e) => {
    e.preventDefault();
    if (!newVideo.title || !newVideo.bunnyVideoId) return;

    setSavingVideo(true);
    try {
      const res = await saveCompetitionGuidanceVideo(selectedCompetition.id, newVideo);
      if (res && res.success) {
        await showSuccess('Guidance video added successfully.');
        setNewVideo({ title: '', bunnyVideoId: '', duration: '', sortOrder: 0 });
        loadTabData('videos', selectedCompetition.id);
      } else {
        await showError(res?.message || 'Failed to add guidance video');
      }
    } catch (err) {
      await showError(err.message || 'Failed to add guidance video');
    } finally {
      setSavingVideo(false);
    }
  };

  const handleGuidanceVideoUploadComplete = async (uploadRes) => {
    if (!uploadRes) return;
    const autoTitle = uploadRes.title || uploadRes.name?.replace(/\.[^/.]+$/, '') || 'Guidance Video';
    const videoGuid = uploadRes.bunnyVideoId || uploadRes.videoId || uploadRes.id;
    const duration = uploadRes.duration || '';

    setSavingVideo(true);
    try {
      const res = await saveCompetitionGuidanceVideo(selectedCompetition.id, {
        title: autoTitle,
        bunnyVideoId: videoGuid,
        duration: duration,
        sortOrder: videos.length + 1
      });
      if (res && res.success) {
        await showSuccess(`"${autoTitle}" uploaded and saved to Guidance Videos.`);
        loadTabData('videos', selectedCompetition.id);
      } else {
        await showError(res?.message || 'Failed to save guidance video');
      }
    } catch (err) {
      await showError(err.message || 'Failed to save guidance video');
    } finally {
      setSavingVideo(false);
    }
  };

  const handleGuidanceMultiUploadComplete = async (uploadResults) => {
    if (!uploadResults || uploadResults.length === 0) return;
    for (const item of uploadResults) {
      await handleGuidanceVideoUploadComplete(item);
    }
  };

  const handleMoveVideo = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= videos.length) return;

    const reordered = [...videos];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    setVideos(reordered);
    const videoIds = reordered.map((v) => v.id);

    try {
      setReorderingVideos(true);
      await reorderCompetitionGuidanceVideos(selectedCompetition.id, videoIds);
    } catch (err) {
      console.error('Failed to reorder guidance videos:', err);
      showError('Failed to save video order');
      loadTabData('videos', selectedCompetition.id);
    } finally {
      setReorderingVideos(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    try {
      const res = await deleteCompetitionGuidanceVideo(videoId);
      if (res && res.success) {
        await showSuccess('Video removed.');
        loadTabData('videos', selectedCompetition.id);
      } else {
        await showError(res?.message || 'Failed to delete video');
      }
    } catch (err) {
      await showError(err.message || 'Failed to delete video');
    }
  };

  // --- Study Material Handlers ---
  const handleMaterialUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isDoc = lowerName.endsWith('.pdf') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx') || lowerName.endsWith('.txt');
    if (!isDoc) {
      showWarning('Study materials must be documents (PDF, DOC/DOCX, or TXT). Media files are rejected.', 'Invalid Document Type');
      return;
    }

    setMaterialUploading(true);
    try {
      const uploadRes = await uploadFile(file, 'private');
      const storedId = uploadRes.fileId || uploadRes.id;
      const fileExt = lowerName.split('.').pop();
      const payload = {
        title: newMaterial.title || file.name,
        storedFileId: storedId,
        fileType: fileExt,
        sortOrder: newMaterial.sortOrder || 0
      };
      const res = await saveCompetitionStudyMaterial(selectedCompetition.id, payload);
      if (res && res.success) {
        await showSuccess('Study material uploaded successfully.');
        setNewMaterial({ title: '', sortOrder: 0 });
        loadTabData('materials', selectedCompetition.id);
      } else {
        await showError(res?.message || 'Failed to save study material');
      }
    } catch (err) {
      await showError(err.message || 'Upload failed');
    } finally {
      setMaterialUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteMaterial = async (matId) => {
    try {
      const res = await deleteCompetitionStudyMaterial(matId);
      if (res && res.success) {
        await showSuccess('Study material removed.');
        loadTabData('materials', selectedCompetition.id);
      } else {
        await showError(res?.message || 'Failed to delete material');
      }
    } catch (err) {
      await showError(err.message || 'Failed to delete material');
    }
  };

  // --- Assessment Slot Edit & Publish ---
  const openSlotEdit = (asmt) => {
    setEditingSlot(asmt);
    setSlotFormData({
      title: asmt.title || '',
      durationMinutes: asmt.durationMinutes || 20,
      totalMarks: asmt.totalMarks || 0,
      startAt: toLocalDatetimeInput(asmt.startAt),
      endAt: toLocalDatetimeInput(asmt.endAt)
    });
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!editingSlot) return;

    setSavingSlot(true);
    try {
      const payload = {
        title: slotFormData.title?.trim()
      };
      if (editingSlot.type !== 'TEST_SERIES') {
        payload.durationMinutes = Number(slotFormData.durationMinutes || 20);
      }
      if (editingSlot.type === 'MOCK' || editingSlot.type === 'FINAL') {
        payload.startAt = toUtcIsoString(slotFormData.startAt);
        payload.endAt = toUtcIsoString(slotFormData.endAt);
      }
      const res = await updateCompetitionAssessment(editingSlot.id, payload);
      if (res && res.success) {
        await showSuccess('Assessment settings saved.');
        setEditingSlot(null);
        loadTabData(activeTab, selectedCompetition.id);
      } else {
        await showError(res?.message || 'Failed to update settings');
      }
    } catch (err) {
      await showError(err.message || 'Failed to update settings');
    } finally {
      setSavingSlot(false);
    }
  };

  const handlePublishAssessment = async (asmt) => {
    try {
      const res = await publishCompetitionAssessment(asmt.id);
      if (res && res.success) {
        await showSuccess(`"${asmt.title}" published successfully!`, 'Published');
        loadTabData(activeTab, selectedCompetition.id);
      } else {
        await showError(res?.message || 'Publishing failed', 'Validation Error');
      }
    } catch (err) {
      await showError(err.message || 'Publishing failed', 'Validation Error');
    }
  };

  const handleOpenRepublishModal = async (asmt) => {
    setRepublishModalData({
      open: true,
      assessment: asmt,
      attemptCount: 0,
      understand: false,
      loading: true
    });
    try {
      const repInfo = await getAssessmentRepublishInfo(asmt.id);
      const count = repInfo?.data?.attemptCount ?? repInfo?.attemptCount ?? 0;
      setRepublishModalData(prev => ({
        ...prev,
        attemptCount: count,
        loading: false
      }));
    } catch {
      setRepublishModalData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleConfirmRepublish = async () => {
    const asmt = republishModalData.assessment;
    if (!asmt || !republishModalData.understand || isRepublishingRef.current) return;

    isRepublishingRef.current = true;
    setRepublishModalData(prev => ({ ...prev, loading: true }));
    try {
      const res = await republishCompetitionAssessment(asmt.id);
      if (res && res.success) {
        await showSuccess(
          `"${asmt.title}" republished successfully! All previous attempts were cleared. Version ${res.data?.publishVersion || 'new'} is now open for students.`,
          'Republished'
        );
        setRepublishModalData({ open: false, assessment: null, attemptCount: 0, understand: false, loading: false });
        loadTabData(activeTab, selectedCompetition.id);
      } else {
        await showError(res?.message || 'Failed to republish assessment');
        setRepublishModalData(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      await showError(err.message || 'Failed to republish assessment');
      setRepublishModalData(prev => ({ ...prev, loading: false }));
    } finally {
      isRepublishingRef.current = false;
    }
  };

  // --- Questions Builder Handlers ---
  const openQuestionsBuilder = async (asmt) => {
    setActiveAsmtForQuestions(asmt);
    setLoadingQuestions(true);
    try {
      const [res, repInfo] = await Promise.all([
        getAssessmentQuestions(asmt.id),
        getAssessmentRepublishInfo(asmt.id).catch(() => ({ success: true, data: { attemptCount: 0 } }))
      ]);
      const qs = res?.data || [];
      setQuestions(qs);
      setAssessments((prev) =>
        prev.map((a) => (a.id === asmt.id ? { ...a, questionCount: qs.length } : a))
      );
      const count = repInfo?.data?.attemptCount ?? repInfo?.attemptCount ?? 0;
      setAttemptCountForEditor(count);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const openAddQuestion = () => {
    setQuestionFormData({
      id: null,
      questionFormat: 'MCQ',
      questionText: '',
      mediaRef: '',
      answerFormat: 'MCQ_OPTIONS',
      guidanceText: '',
      maxDurationSeconds: 120,
      marks: 1,
      sortOrder: questions.length + 1,
      explanation: '',
      options: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ],
      evaluationCriteria: [
        { title: 'Fluency & Pronunciation', maxMarks: 5 },
        { title: 'Grammar & Vocabulary', maxMarks: 5 }
      ]
    });
    setPreviewMode(false);
    setShowQuestionModal(true);
  };

  const openEditQuestion = (q) => {
    setQuestionFormData({
      id: q.id,
      questionFormat: q.questionFormat || 'MCQ',
      questionText: q.questionText || '',
      mediaRef: q.mediaRef || '',
      answerFormat: q.answerFormat || 'MCQ_OPTIONS',
      guidanceText: q.guidanceText || '',
      maxDurationSeconds: q.maxDurationSeconds || 120,
      marks: q.marks || 1,
      sortOrder: q.sortOrder || 0,
      explanation: q.explanation || '',
      options: q.options && q.options.length > 0 ? q.options.map(o => ({ ...o })) : [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ],
      evaluationCriteria: q.evaluationCriteria && q.evaluationCriteria.length > 0 ? q.evaluationCriteria.map(c => ({ ...c })) : [
        { title: 'Fluency & Pronunciation', maxMarks: 5 },
        { title: 'Grammar & Vocabulary', maxMarks: 5 }
      ]
    });
    setPreviewMode(false);
    setShowQuestionModal(true);
  };

  const handleDuplicateQuestion = async (questionId) => {
    try {
      const res = await duplicateAssessmentQuestion(questionId);
      if (res && res.success) {
        await showSuccess('Question duplicated successfully.');
        await openQuestionsBuilder(activeAsmtForQuestions);
      } else {
        await showError(res?.message || 'Duplication failed');
      }
    } catch (err) {
      await showError(err.message || 'Duplication failed');
    }
  };

  const handleMoveQuestion = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const reordered = [...questions];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    const ids = reordered.map(q => q.id);
    try {
      const res = await reorderAssessmentQuestions(activeAsmtForQuestions.id, ids);
      if (res && res.success) {
        setQuestions(res.data);
      }
    } catch (err) {
      console.error('Reorder error:', err);
    }
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!questionFormData.questionText.trim()) return;

    const qFormat = (questionFormData.questionFormat || 'MCQ').toUpperCase();
    if (['IMAGE', 'VIDEO', 'AUDIO'].includes(qFormat)) {
      if (isMediaUploading) {
        showWarning('Please wait for the media file upload to complete.', 'Upload in Progress');
        return;
      }
      if (!questionFormData.mediaRef || !questionFormData.mediaRef.trim()) {
        const typeName = qFormat === 'IMAGE' ? 'image' : qFormat === 'VIDEO' ? 'video' : 'audio';
        showWarning(`Please upload an ${typeName} file for this question.`, 'Media Required');
        return;
      }
    }

    if (questionFormData.answerFormat === 'MCQ_OPTIONS') {
      const correctCount = questionFormData.options.filter(o => o.isCorrect).length;
      if (correctCount !== 1) {
        showWarning('Please select exactly one correct option.', 'Options Validation');
        return;
      }
    }

    setSavingQuestion(true);
    try {
      const res = await saveAssessmentQuestion(activeAsmtForQuestions.id, questionFormData);
      if (res && res.success) {
        await showSuccess('Question saved successfully.');
        setShowQuestionModal(false);
        await openQuestionsBuilder(activeAsmtForQuestions);
      } else {
        await showError(res?.message || 'Failed to save question');
      }
    } catch (err) {
      await showError(err.message || 'Failed to save question');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      const res = await deleteAssessmentQuestion(questionId);
      if (res && res.success) {
        await showSuccess('Question deleted.');
        await openQuestionsBuilder(activeAsmtForQuestions);
      } else {
        await showError(res?.message || 'Failed to delete question');
      }
    } catch (err) {
      await showError(err.message || 'Failed to delete question');
    }
  };

  // --- Student CSV Export ---
  const handleExportStudentsCSV = () => {
    if (!students || students.length === 0) {
      showWarning('No student registrations available to export.');
      return;
    }
    const headers = ['ID', 'Student Name', 'Email', 'Phone', 'Set', 'Payment Status', 'Amount (INR)', 'Registered Date', 'Paid Date'];
    const rows = filteredStudents.map(s => [
      s.id,
      `"${(s.studentName || '').replace(/"/g, '""')}"`,
      `"${s.studentEmail || ''}"`,
      `"${s.studentPhone || ''}"`,
      s.setCode || 'Unassigned',
      s.paymentStatus || 'Pending',
      s.amount || 0,
      s.createdAt ? formatDate(s.createdAt) : '',
      s.paidAt ? formatDate(s.paidAt) : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedCompetition.title.replace(/\s+/g, '_')}_students.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Students (Registered Students must show ONLY SUCCESS / PAID candidates)
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const isPaid = s.paymentStatus && (s.paymentStatus.toUpperCase() === 'SUCCESS' || s.paymentStatus.toUpperCase() === 'PAID');
      if (!isPaid) return false;

      const matchesSearch = !studentSearch || (
        (s.studentName && s.studentName.toLowerCase().includes(studentSearch.toLowerCase())) ||
        (s.studentEmail && s.studentEmail.toLowerCase().includes(studentSearch.toLowerCase())) ||
        (s.studentPhone && s.studentPhone.includes(studentSearch))
      );
      const matchesSet = setFilter === 'ALL' || (s.setCode === setFilter) || (setFilter === 'UNASSIGNED' && !s.setCode);
      return matchesSearch && matchesSet;
    });
  }, [students, studentSearch, setFilter]);

  if (loadingCompetitions) {
    return <PageLoader text="Loading competitions management..." />;
  }

  if (competitions.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
        <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">No Competitions Found</h3>
        <p className="text-xs text-slate-500 mt-1">Create a competition in the Competitions section first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION HEADER & COMPETITIONS TOP SWITCH BAR */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Award className="w-6 h-6 text-indigo-600" />
              <span>Competition Management</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Scope content, sets, trainers, assessments, and leaderboards per competition.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Active Competition:</span>
            <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
              {selectedCompetition?.title}
            </span>
          </div>
        </div>

        {/* TOP SWITCH BAR: COMPETITION TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-slate-100 pt-3 no-scrollbar">
          {competitions.map((comp) => {
            const isSelected = comp.id === selectedCompetition?.id;
            return (
              <button
                key={comp.id}
                onClick={() => handleCompetitionSwitch(comp.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Trophy className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{comp.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
                }`}>
                  {comp.status || 'Active'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TABS NAVIGATION BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex items-center gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'students', label: 'Registered Students', icon: Users },
          { id: 'syllabus', label: 'Syllabus', icon: BookOpen },
          { id: 'videos', label: 'Guidance Videos', icon: Video },
          { id: 'materials', label: 'Study Materials', icon: FileText },
          { id: 'test-series', label: 'Test Series (35)', icon: Layers },
          { id: 'mock-tests', label: 'Mock Tests (4)', icon: Clock },
          { id: 'final-assessment', label: 'Final Assessment', icon: Trophy },
          { id: 'sets', label: 'Sets & Trainers', icon: Users },
          { id: 'evaluations', label: 'Evaluations', icon: CheckCircle2 },
          { id: 'leaderboard', label: 'Results & Leaderboard', icon: Award }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loadingOverview ? (
            <div className="py-12 flex justify-center"><InlineSpinner text="Loading competition overview metrics..." /></div>
          ) : (
            <>
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Total Registrations</span>
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{overviewData?.totalRegistrations ?? 0}</div>
                  <p className="text-[11px] text-slate-400 font-semibold">{overviewData?.paidRegistrations ?? 0} Paid • {overviewData?.pendingRegistrations ?? 0} Pending</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Sets Distribution</span>
                    <Layers className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">4 Sets (A - D)</div>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {overviewData?.sets?.map(s => `${s.code}: ${s.memberCount}`).join(' • ') || 'A: 0 • B: 0 • C: 0 • D: 0'}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Published Assessments</span>
                    <Trophy className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {overviewData?.publishedAssessmentsCount ?? 0} / {overviewData?.totalAssessmentsCount ?? 40}
                  </div>
                  <p className="text-[11px] text-slate-400 font-semibold">35 Test Series • 4 Mocks • 1 Final</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <span>Content Uploaded</span>
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {overviewData?.hasSyllabus ? 'Syllabus Ready' : 'No Syllabus'}
                  </div>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {overviewData?.guidanceVideosCount ?? 0} Videos • {overviewData?.studyMaterialsCount ?? 0} Materials
                  </p>
                </div>
              </div>

              {/* Sets & Trainers Summary Table */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Set Distribution & Assigned Trainers</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(overviewData?.sets || []).map((s) => (
                    <div key={s.id || s.code} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-slate-900">Set {s.code}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          {s.memberCount} Students
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        {s.trainerName ? (
                          <div>
                            <span className="font-bold text-slate-900">{s.trainerName}</span>
                            <div className="text-[11px] text-slate-400 truncate">{s.trainerEmail}</div>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-semibold">No Trainer Assigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SUB-TAB 2: REGISTERED STUDENTS */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Registered Students ({filteredStudents.length})</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Competition-specific student list, assigned set codes, payment verification.
              </p>
            </div>
            <button
              onClick={handleExportStudentsCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name, email, phone..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>
            <div>
              <select
                value={setFilter}
                onChange={(e) => setSetFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Sets</option>
                <option value="A">Set A</option>
                <option value="B">Set B</option>
                <option value="C">Set C</option>
                <option value="D">Set D</option>
                <option value="UNASSIGNED">Unassigned</option>
              </select>
            </div>
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Payments</option>
                <option value="PAID">PAID Only</option>
                <option value="PENDING">Pending Only</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loadingStudents ? (
            <div className="py-12 flex justify-center"><InlineSpinner text="Loading registered students..." /></div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
              No registered students match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="p-3">#</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Set</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Registered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((std, idx) => (
                    <tr key={std.id || idx} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{std.studentName || 'Student'}</td>
                      <td className="p-3 text-slate-600 font-medium">{std.studentEmail}</td>
                      <td className="p-3 text-slate-600 font-medium">{std.studentPhone || '—'}</td>
                      <td className="p-3">
                        {std.setCode ? (
                          <span className="px-2 py-0.5 rounded-full font-black text-[11px] bg-purple-50 text-purple-700 border border-purple-200">
                            Set {std.setCode}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          std.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {std.paymentStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 font-medium">
                        {std.createdAt ? formatDate(std.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: SYLLABUS */}
      {activeTab === 'syllabus' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Official Competition Syllabus</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Upload a single official syllabus document (PDF, DOC/DOCX, or TXT).
            </p>
          </div>

          {syllabus ? (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-black text-sm text-slate-900">{syllabus.title}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      File: {syllabus.fileName || 'Syllabus Document'} • Format: {syllabus.fileType?.toUpperCase()} • Last updated: {formatDate(syllabus.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{sylUploading ? 'Replacing...' : 'Replace'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={handleSyllabusUpload}
                      disabled={sylUploading}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleDeleteSyllabus}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Inline Syllabus Preview Card */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Inline Syllabus Document Preview
                </span>

                {syllabus.fileType === 'pdf' || (syllabus.fileName && syllabus.fileName.toLowerCase().endsWith('.pdf')) ? (
                  <div className="w-full h-96 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-inner">
                    <iframe
                      src={`${inlineSyllabusUrl || resolveFileUrl(syllabus.viewUrl)}#toolbar=0&navpanes=0`}
                      className="w-full h-full border-0 select-none"
                      title="Syllabus Preview"
                    />
                  </div>
                ) : syllabus.fileType === 'txt' || (syllabus.fileName && syllabus.fileName.toLowerCase().endsWith('.txt')) ? (
                  <div className="w-full h-96 rounded-xl border border-slate-200 overflow-auto bg-white p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap select-none shadow-inner">
                    {inlineSyllabusText || 'Loading text document preview...'}
                  </div>
                ) : ['png', 'jpg', 'jpeg', 'webp'].includes(syllabus.fileType?.toLowerCase()) ? (
                  <div className="flex justify-center p-2 bg-white rounded-xl border border-slate-200">
                    <img
                      src={inlineSyllabusUrl || resolveFileUrl(syllabus.viewUrl)}
                      alt="Syllabus Preview"
                      className="max-h-96 rounded-lg object-contain shadow-xs"
                    />
                  </div>
                ) : (
                  <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-3">
                    <FileText className="w-10 h-10 text-indigo-500 mx-auto" />
                    <div>
                      <p className="font-bold text-xs text-slate-800">Office Document / Non-inline Preview</p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        File: {syllabus.fileName || syllabus.title} ({syllabus.fileType?.toUpperCase()})
                        {syllabus.fileSize ? ` • ${(syllabus.fileSize / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => openFileWithSignedLink(syllabus.storedFileId || syllabus.id, syllabus.fileName || `${syllabus.title}.${syllabus.fileType}`)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl inline-flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <Download className="w-4 h-4" />
                        <span>Admin Download</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xs">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-xs text-slate-700">No syllabus uploaded yet</p>
                <p className="text-[11px] text-slate-500">Upload PDF, DOC, DOCX, or TXT document</p>
              </div>
              <div className="pt-2 flex justify-center">
                <label className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs">
                  {sylUploading ? 'Uploading...' : 'Choose File to Upload'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={handleSyllabusUpload}
                    disabled={sylUploading}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: GUIDANCE VIDEOS */}
      {activeTab === 'videos' && (
        <GuidanceVideoManager
          competitionId={selectedCompetition.id}
          competitionTitle={selectedCompetition.title}
        />
      )}

      {/* SUB-TAB 5: STUDY MATERIALS */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Competition Study Materials</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">Upload PDF/DOCX/TXT study materials for participants.</p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3 text-xs">
            <input
              type="text"
              placeholder="Material title (optional)..."
              value={newMaterial.title}
              onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
              className="flex-1 p-2 bg-white border border-slate-200 rounded-xl font-semibold"
            />
            <label className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer">
              {materialUploading ? 'Uploading...' : 'Upload Document'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={handleMaterialUpload}
                disabled={materialUploading}
              />
            </label>
          </div>

          {materials.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              No study materials uploaded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((mat) => (
                <div key={mat.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="font-black text-xs text-slate-900">{mat.title}</h4>
                      <p className="text-[10px] text-slate-400 font-medium">Type: {mat.fileType?.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {mat.viewUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingFile({
                          id: mat.storedFileId || mat.id,
                          url: mat.viewUrl,
                          name: mat.fileName || mat.title,
                          title: mat.title,
                          type: mat.fileType
                        })}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg cursor-pointer flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Preview</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMaterial(mat.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TABS 6, 7, 8: ASSESSMENTS LIST (TEST SERIES, MOCK TESTS, FINAL) */}
      {(['test-series', 'mock-tests', 'final-assessment'].includes(activeTab)) && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>
                {activeTab === 'test-series' && 'Test Series (35 Slots)'}
                {activeTab === 'mock-tests' && 'Mock Tests (4 Slots)'}
                {activeTab === 'final-assessment' && 'Final Assessment (1 Slot)'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {activeTab === 'test-series' && 'Tests 1-35 support multi-format questions (MCQ, Audio, Video, Image, Text) and multi-format answers (MCQ, Voice, Text).'}
              {activeTab === 'mock-tests' && 'Each mock test has independent start and end times scheduled within the competition window.'}
              {activeTab === 'final-assessment' && 'Requires duration, final unlock time, and all 4 set trainers assigned before publish.'}
            </p>
          </div>

          {loadingAssessments ? (
            <div className="py-12 flex justify-center"><InlineSpinner text="Loading assessment slots..." /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assessments
                .filter(a => {
                  if (activeTab === 'test-series') return a.type === 'TEST_SERIES';
                  if (activeTab === 'mock-tests') return a.type === 'MOCK';
                  if (activeTab === 'final-assessment') return a.type === 'FINAL';
                  return true;
                })
                .map((asmt) => (
                  <div key={asmt.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Slot #{asmt.sequenceNo}
                        </span>
                        <h4 className="font-black text-xs text-slate-900 mt-1">{asmt.title}</h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {asmt.publishVersion && asmt.publishVersion > 1 && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                            v{asmt.publishVersion}
                          </span>
                        )}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          asmt.status === 'PUBLISHED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {asmt.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-semibold bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      {asmt.type !== 'TEST_SERIES' && (
                        <div>Duration: <span className="font-bold text-slate-900">{asmt.durationMinutes}m</span></div>
                      )}
                      <div className={asmt.type === 'TEST_SERIES' ? 'col-span-2' : ''}>
                        Total Marks: <span className="font-bold text-slate-900">{asmt.totalMarks ?? 0}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-between text-indigo-700 bg-indigo-50/70 border border-indigo-100/60 rounded-xl px-2.5 py-1">
                        <span className="font-bold">Total Questions:</span>
                        <span className="font-black font-mono">
                          {asmt.questionCount ?? 0}
                        </span>
                      </div>
                      {asmt.startAt && (
                        <div className="col-span-2 text-[10px]">
                          Window: {formatDate(asmt.startAt)} - {formatDate(asmt.endAt)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openSlotEdit(asmt)}
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl cursor-pointer"
                      >
                        Edit Settings
                      </button>
                      <button
                        onClick={() => openQuestionsBuilder(asmt)}
                        className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-xl cursor-pointer"
                      >
                        Questions
                      </button>
                      {asmt.status !== 'PUBLISHED' ? (
                        <button
                          onClick={() => handlePublishAssessment(asmt)}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl cursor-pointer"
                          title="Validate and publish assessment"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenRepublishModal(asmt)}
                          className="py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl cursor-pointer flex items-center gap-1 shrink-0"
                          title="Republish to open a fresh attempt cycle for students"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Republish</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 9: SETS & TRAINERS */}
      {activeTab === 'sets' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Sets & Trainer Assignments</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Every competition has 4 balanced Sets (A, B, C, D) with exactly one assigned trainer each.
            </p>
          </div>

          {loadingSets ? (
            <div className="py-12 flex justify-center"><InlineSpinner text="Loading sets and trainers..." /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {sets.map((s) => (
                <div key={s.id} className="p-5 rounded-3xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900">Set {s.code}</span>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">
                      {s.memberCount} Students
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Assigned Trainer</label>
                    <select
                      value={s.trainerId || ''}
                      onChange={(e) => handleAssignTrainer(s.code, e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="">-- No Trainer Assigned --</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {s.trainerName && (
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px]">
                      <span className="font-bold text-emerald-900">Assigned: {s.trainerName}</span>
                      <p className="text-[10px] text-emerald-600 truncate">{s.trainerEmail}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 10: EVALUATIONS MONITOR */}
      {activeTab === 'evaluations' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>Voice Evaluations Progress</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Monitor trainer evaluation status on voice recording responses across all 4 sets.
          </p>
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
            Evaluation pipeline active. As students submit assessments with voice answers, pending items populate trainer queues.
          </div>
        </div>
      )}

      {/* SUB-TAB 11: RESULTS & LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-600" />
            <span>Results & Published Leaderboard</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Status: <span className="font-bold text-indigo-700">{selectedCompetition?.leaderboardStatus || 'NOT_PUBLISHED'}</span> • 
            Scheduled Publish Time: {selectedCompetition?.leaderboardPublishedAt ? formatDate(selectedCompetition.leaderboardPublishedAt) : 'Configured at 5 days post-completion'}
          </p>
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
            Leaderboard generation runs on final assessment submissions. Tie-breaking rules: Higher final marks, earlier submission time, earlier registration date.
          </div>
        </div>
      )}

      {/* MODAL: EDIT SLOT SETTINGS */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-black text-slate-900">
              Edit Slot Settings: {editingSlot.title}
            </h3>
            <form onSubmit={handleSaveSlot} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={slotFormData.title}
                  onChange={(e) => setSlotFormData({ ...slotFormData, title: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              {/* For TEST_SERIES: ONLY Title is editable. Duration and Total Marks are removed. */}
              {editingSlot.type !== 'TEST_SERIES' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Duration (Mins) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={slotFormData.durationMinutes}
                      onChange={(e) => setSlotFormData({ ...slotFormData, durationMinutes: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Total Marks</label>
                    <div className="w-full p-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-600">
                      {editingSlot.totalMarks ?? 0} (auto-computed)
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[11px] text-indigo-900">
                  <p><strong>Total Marks:</strong> {editingSlot.totalMarks ?? 0} (computed automatically from questions)</p>
                  <p className="text-[10px] text-slate-500 mt-1">Duration is not applicable to Test Series.</p>
                </div>
              )}

              {editingSlot.type === 'MOCK' && (
                <div className="space-y-2 border-t border-slate-100 pt-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mock Start Time (Local)</label>
                    <input
                      type="datetime-local"
                      value={slotFormData.startAt}
                      onChange={(e) => setSlotFormData({ ...slotFormData, startAt: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mock End Time (Local)</label>
                    <input
                      type="datetime-local"
                      value={slotFormData.endAt}
                      onChange={(e) => setSlotFormData({ ...slotFormData, endAt: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <ButtonSpinner
                  type="submit"
                  loading={savingSlot}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                >
                  Save Settings
                </ButtonSpinner>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUESTIONS BUILDER */}
      {activeAsmtForQuestions && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Question Builder: {activeAsmtForQuestions.title}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {questions.length} questions • Slot Type: {activeAsmtForQuestions.type}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openAddQuestion}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>
                <button
                  onClick={() => setActiveAsmtForQuestions(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Task K3: Non-blocking attempt banner */}
            {attemptCountForEditor > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{attemptCountForEditor} student{attemptCountForEditor === 1 ? '' : 's'} have already attempted this test.</span>
                  <span className="block mt-0.5 text-amber-800 text-[11px]">
                    Existing results stay as stored. Use Republish to apply your changes for everyone (this deletes all previous attempts).
                  </span>
                </div>
              </div>
            )}

            {loadingQuestions ? (
              <div className="py-12 flex justify-center"><InlineSpinner text="Loading questions..." /></div>
            ) : questions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                No questions authored yet for this slot. Click "Add Question" to begin.
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div key={q.id || idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-blue-50 text-blue-700">
                          {q.questionFormat}
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700">
                          {q.answerFormat}
                        </span>
                        <span className="text-slate-500 font-bold">({q.marks} Marks)</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveQuestion(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg cursor-pointer"
                          title="Move Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveQuestion(idx, 1)}
                          disabled={idx === questions.length - 1}
                          className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg cursor-pointer"
                          title="Move Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicateQuestion(q.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Duplicate Question"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditQuestion(q)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                          title="Edit Question"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Shared miniature preview mirroring student layout (Task K4) */}
                    <div className="pt-1">
                      <QuestionPreview question={q} isAdmin={true} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-MODAL: ADD / EDIT QUESTION FORM */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900">
                {questionFormData.id ? 'Edit Question' : 'Add New Question'}
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    previewMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{previewMode ? 'Exit Preview' : 'Student Preview'}</span>
                </button>
              </div>
            </div>

            {previewMode ? (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Student Perspective Preview
                  </span>
                </div>
                {questionFormData.questionFormat === 'AUDIO' && questionFormData.mediaRef && (
                  <div className="mb-3">
                    <span className="text-xs font-bold text-slate-700 block mb-1">Audio Prompt Playback:</span>
                    <AudioPromptPlayer src={questionFormData.mediaRef} title="Question Audio Prompt" />
                  </div>
                )}
                <QuestionPreview question={questionFormData} isAdmin={false} />
              </div>
            ) : (
              <form onSubmit={handleSaveQuestion} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Question Format</label>
                    <select
                      value={questionFormData.questionFormat}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, questionFormat: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="MCQ">MCQ (Text)</option>
                      <option value="TEXT">Text Only</option>
                      <option value="IMAGE">Image Prompt</option>
                      <option value="AUDIO">Audio Prompt</option>
                      <option value="VIDEO">Video Prompt</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Answer Format</label>
                    <select
                      value={questionFormData.answerFormat}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, answerFormat: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="MCQ_OPTIONS">MCQ Options</option>
                      <option value="VOICE">Voice Recording</option>
                      <option value="TEXT">Written Text Answer</option>
                    </select>
                  </div>
                </div>

                {questionFormData.questionFormat !== 'MCQ' && questionFormData.questionFormat !== 'TEXT' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Question Media Prompt ({
                        questionFormData.questionFormat === 'AUDIO' ? 'Audio Upload' : 
                        questionFormData.questionFormat === 'IMAGE' ? 'Image Upload' : 'Video Upload'
                      })
                    </label>
                    <UnifiedUploader
                      accept={
                        questionFormData.questionFormat === 'AUDIO' ? 'audio/*' : 
                        questionFormData.questionFormat === 'IMAGE' ? 'image/*' : 'video/*'
                      }
                      multiple={false}
                      category="question-media"
                      maxSizeMB={200}
                      onUploadingChange={setIsMediaUploading}
                      initialValue={
                        questionFormData.mediaRef
                          ? {
                              id: questionFormData.mediaRef,
                              isAudio: questionFormData.questionFormat === 'AUDIO',
                              isImage: questionFormData.questionFormat === 'IMAGE',
                              bunnyVideoId: questionFormData.questionFormat === 'VIDEO' ? questionFormData.mediaRef : null,
                              url: resolveFileUrl(questionFormData.mediaRef),
                              name: questionFormData.questionFormat === 'AUDIO'
                                ? `Audio Prompt (${questionFormData.mediaRef.substring(0, 8)}...)`
                                : questionFormData.questionFormat === 'IMAGE'
                                ? `Image Prompt (${questionFormData.mediaRef.substring(0, 8)}...)`
                                : `Video Prompt (${questionFormData.mediaRef.substring(0, 8)}...)`
                            }
                          : null
                      }
                      onUploadComplete={(res) => {
                        const refId = res.bunnyVideoId || res.videoId || res.id;
                        setQuestionFormData((prev) => ({ ...prev, mediaRef: refId }));
                      }}
                      onClear={() => setQuestionFormData((prev) => ({ ...prev, mediaRef: '' }))}
                      helperText={
                        questionFormData.questionFormat === 'AUDIO'
                          ? 'Upload audio question prompt (.mp3, .wav, .ogg, .m4a). Stored via Bunny Storage.'
                          : questionFormData.questionFormat === 'IMAGE'
                          ? 'Upload image question prompt (.png, .jpg, .webp). Stored via Bunny Storage.'
                          : 'Upload video question prompt (.mp4, .webm, .mov). Streamed via Bunny Stream.'
                      }
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Question Prompt *</label>
                  <textarea
                    required
                    rows={3}
                    value={questionFormData.questionText}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, questionText: e.target.value })}
                    placeholder="Enter question prompt..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                {questionFormData.answerFormat === 'VOICE' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Guidance Text (Optional)</label>
                      <input
                        type="text"
                        value={questionFormData.guidanceText}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, guidanceText: e.target.value })}
                        placeholder="e.g. Speak clearly for 60 seconds"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Max Duration (Seconds)</label>
                      <input
                        type="number"
                        min="30"
                        max="300"
                        value={questionFormData.maxDurationSeconds}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, maxDurationSeconds: Number(e.target.value) })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Marks</label>
                    <input
                      type="number"
                      min="1"
                      value={questionFormData.marks}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, marks: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={questionFormData.sortOrder}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, sortOrder: Number(e.target.value) })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    />
                  </div>
                </div>

                {/* MCQ Options */}
                {questionFormData.answerFormat === 'MCQ_OPTIONS' && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <label className="block font-bold text-slate-700">Options (Select the exactly one correct option):</label>
                    {questionFormData.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="correctOptionRadio"
                          checked={opt.isCorrect}
                          onChange={() => {
                            const updated = questionFormData.options.map((o, i) => ({
                              ...o,
                              isCorrect: i === optIdx
                            }));
                            setQuestionFormData({ ...questionFormData, options: updated });
                          }}
                          className="cursor-pointer"
                        />
                        <input
                          type="text"
                          required
                          placeholder={`Option ${optIdx + 1}`}
                          value={opt.text}
                          onChange={(e) => {
                            const updated = [...questionFormData.options];
                            updated[optIdx] = { ...updated[optIdx], text: e.target.value };
                            setQuestionFormData({ ...questionFormData, options: updated });
                          }}
                          className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Explanation / Solution Note</label>
                  <textarea
                    rows={2}
                    value={questionFormData.explanation}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, explanation: e.target.value })}
                    placeholder="Explanation visible during answer review..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowQuestionModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <ButtonSpinner
                    type="submit"
                    loading={savingQuestion}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                  >
                    Save Question
                  </ButtonSpinner>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Task K7: Republish Confirmation Modal */}
      {republishModalData.open && (
        <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Republish Test Confirmation</h4>
                <p className="text-xs text-slate-500 font-semibold">{republishModalData.assessment?.title}</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900">
              <p className="font-bold leading-relaxed">
                Republish will permanently delete all {republishModalData.loading ? '...' : (republishModalData.attemptCount || 0)} existing attempts and recordings for this test. Candidates will have to retake it. Check 'I understand' to proceed.
              </p>
              <p className="text-[11px] text-rose-700">
                {republishModalData.loading
                  ? 'Calculating affected attempts...'
                  : `${republishModalData.attemptCount || 0} student attempt(s) will be permanently deleted.`}
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={republishModalData.understand}
                onChange={(e) => setRepublishModalData(prev => ({ ...prev, understand: e.target.checked }))}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-700">
                I understand that all previous attempts, recordings and scores will be permanently deleted.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRepublishModalData({ open: false, assessment: null, attemptCount: 0, understand: false, loading: false })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!republishModalData.understand || republishModalData.loading}
                onClick={handleConfirmRepublish}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {republishModalData.loading ? <ButtonSpinner text="Republishing..." /> : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Confirm & Republish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
