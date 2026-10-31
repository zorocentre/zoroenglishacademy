import React, { useState, useEffect } from 'react';
import { 
  X, Trophy, Users, BookOpen, Video, FileText, Layers, Plus, 
  Trash2, Edit, CheckCircle2, AlertCircle, Save, Clock, 
  ExternalLink, Upload, HelpCircle, Check, ArrowRight
} from 'lucide-react';
import { 
  getCompetitionSets, assignTrainerToSet, 
  getCompetitionSyllabus, saveCompetitionSyllabus,
  getCompetitionGuidanceVideos, saveCompetitionGuidanceVideo, deleteCompetitionGuidanceVideo,
  reorderCompetitionGuidanceVideos,
  getCompetitionStudyMaterials, saveCompetitionStudyMaterial, deleteCompetitionStudyMaterial,
  getCompetitionAssessments, updateCompetitionAssessment,
  getAssessmentQuestions, saveAssessmentQuestion, deleteAssessmentQuestion
} from '../../api/competitionApi';
import { getTrainers } from '../../api/userApi';
import { uploadFile, resolveFileUrl } from '../../api/fileApi';
import ButtonSpinner from '../common/ButtonSpinner';
import InlineSpinner from '../common/InlineSpinner';
import UnifiedUploader from '../common/UnifiedUploader';
import SafeVideo from '../common/SafeVideo';
import GuidanceVideoManager from './GuidanceVideoManager';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import QuestionPreview from '../common/QuestionPreview';
import { useDialog } from '../../context/DialogContext';

export default function AdminCompetitionPortalManagerModal({ competition, isOpen, onClose }) {
  const { showSuccess, showError } = useDialog();

  const [activeTab, setActiveTab] = useState('sets'); // 'sets' | 'syllabus' | 'videos' | 'materials' | 'assessments'
  const [loading, setLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  // Data states
  const [trainers, setTrainers] = useState([]);
  const [sets, setSets] = useState([]);
  const [syllabus, setSyllabus] = useState(null);
  const [videos, setVideos] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [assessments, setAssessments] = useState([]);

  // Syllabus form
  const [sylTitle, setSylTitle] = useState('Official Competition Syllabus');
  const [sylUploading, setSylUploading] = useState(false);

  // Video form
  const [newVideo, setNewVideo] = useState({ title: '', bunnyVideoId: '', duration: '', sortOrder: 0 });
  const [savingVideo, setSavingVideo] = useState(false);
  const [previewingVideo, setPreviewingVideo] = useState(null);
  const [reorderingVideos, setReorderingVideos] = useState(false);

  // Material form
  const [newMaterial, setNewMaterial] = useState({ title: '', sortOrder: 0 });
  const [materialUploading, setMaterialUploading] = useState(false);

  // Question Builder state
  const [activeAsmtForQuestions, setActiveAsmtForQuestions] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionFormData, setQuestionFormData] = useState({
    id: null,
    questionFormat: 'MCQ', // 'MCQ' | 'VIDEO' | 'AUDIO'
    questionText: '',
    mediaRef: '',
    answerFormat: 'MCQ_OPTIONS', // 'MCQ_OPTIONS' | 'VOICE'
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

  useEffect(() => {
    if (!isOpen || !competition?.id) return;
    loadAllTabData();
  }, [isOpen, competition]);

  const loadAllTabData = async () => {
    setLoading(true);
    try {
      const [tRes, sRes, sylRes, vRes, mRes, aRes] = await Promise.all([
        getTrainers(),
        getCompetitionSets(competition.id),
        getCompetitionSyllabus(competition.id),
        getCompetitionGuidanceVideos(competition.id),
        getCompetitionStudyMaterials(competition.id),
        getCompetitionAssessments(competition.id)
      ]);
      setTrainers(tRes?.data || []);
      setSets(sRes?.data || []);
      setSyllabus(sylRes?.data || null);
      if (sylRes?.data?.title) setSylTitle(sylRes.data.title);
      setVideos(vRes?.data || []);
      setMaterials(mRes?.data || []);
      setAssessments(aRes?.data || []);
    } catch (err) {
      console.error('Failed to load competition data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !competition) return null;

  // --- Handlers: Sets & Trainers ---
  const handleAssignTrainer = async (code, trainerId) => {
    try {
      const res = await assignTrainerToSet(competition.id, code, trainerId || null);
      if (res.success) {
        await showSuccess(`Trainer assigned to Set ${code} successfully`, 'Set Updated');
        const sRes = await getCompetitionSets(competition.id);
        setSets(sRes?.data || []);
      }
    } catch (err) {
      await showError(err.message || 'Failed to assign trainer', 'Error');
    }
  };

  // --- Handlers: Syllabus ---
  const handleSyllabusFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSylUploading(true);
    try {
      const upRes = await uploadFile(file, 'syllabus');
      if (upRes.success && upRes.data?.id) {
        const saveRes = await saveCompetitionSyllabus(competition.id, {
          title: sylTitle.trim() || 'Competition Syllabus',
          storedFileId: upRes.data.id,
          fileType: 'pdf'
        });
        if (saveRes.success) {
          await showSuccess('Syllabus PDF updated successfully', 'Syllabus Saved');
          const freshSyl = await getCompetitionSyllabus(competition.id);
          setSyllabus(freshSyl?.data || null);
        }
      }
    } catch (err) {
      await showError(err.message || 'Failed to upload syllabus PDF', 'Upload Error');
    } finally {
      setSylUploading(false);
    }
  };

  // --- Handlers: Guidance Videos ---
  const handleSaveVideo = async (e) => {
    e.preventDefault();
    if (!newVideo.title.trim() || !newVideo.bunnyVideoId.trim()) return;
    setSavingVideo(true);
    try {
      const res = await saveCompetitionGuidanceVideo(competition.id, {
        title: newVideo.title.trim(),
        bunnyVideoId: newVideo.bunnyVideoId.trim(),
        duration: newVideo.duration ? Number(newVideo.duration) : null,
        sortOrder: Number(newVideo.sortOrder || 0),
        status: 'PUBLISHED'
      });
      if (res.success) {
        await showSuccess('Guidance video added', 'Video Saved');
        setNewVideo({ title: '', bunnyVideoId: '', duration: '', sortOrder: 0 });
        const vRes = await getCompetitionGuidanceVideos(competition.id);
        setVideos(vRes?.data || []);
      }
    } catch (err) {
      await showError(err.message || 'Failed to save video', 'Error');
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
      const res = await saveCompetitionGuidanceVideo(competition.id, {
        title: autoTitle,
        bunnyVideoId: videoGuid,
        duration: duration,
        sortOrder: videos.length + 1,
        status: 'PUBLISHED'
      });
      if (res && res.success) {
        await showSuccess(`"${autoTitle}" uploaded and added to Guidance Videos.`);
        const vRes = await getCompetitionGuidanceVideos(competition.id);
        setVideos(vRes?.data || []);
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
      await reorderCompetitionGuidanceVideos(competition.id, videoIds);
    } catch (err) {
      console.error('Failed to reorder guidance videos:', err);
      showError('Failed to save video order');
      const vRes = await getCompetitionGuidanceVideos(competition.id);
      setVideos(vRes?.data || []);
    } finally {
      setReorderingVideos(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Delete this guidance video?')) return;
    try {
      const res = await deleteCompetitionGuidanceVideo(videoId);
      if (res.success) {
        setVideos(prev => prev.filter(v => v.id !== videoId));
      }
    } catch (err) {
      await showError(err.message || 'Failed to delete video', 'Error');
    }
  };

  // --- Handlers: Study Materials ---
  const handleMaterialFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newMaterial.title.trim()) {
      await showError('Please enter a title for the study material first.', 'Title Required');
      return;
    }
    setMaterialUploading(true);
    try {
      const upRes = await uploadFile(file, 'material');
      if (upRes.success && upRes.data?.id) {
        const ext = file.name.split('.').pop() || 'pdf';
        const saveRes = await saveCompetitionStudyMaterial(competition.id, {
          title: newMaterial.title.trim(),
          storedFileId: upRes.data.id,
          fileType: ext.toLowerCase(),
          sortOrder: Number(newMaterial.sortOrder || 0)
        });
        if (saveRes.success) {
          await showSuccess('Study material uploaded', 'Material Added');
          setNewMaterial({ title: '', sortOrder: 0 });
          const mRes = await getCompetitionStudyMaterials(competition.id);
          setMaterials(mRes?.data || []);
        }
      }
    } catch (err) {
      await showError(err.message || 'Failed to upload study material', 'Upload Error');
    } finally {
      setMaterialUploading(false);
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (!window.confirm('Delete this study material?')) return;
    try {
      const res = await deleteCompetitionStudyMaterial(materialId);
      if (res.success) {
        setMaterials(prev => prev.filter(m => m.id !== materialId));
      }
    } catch (err) {
      await showError(err.message || 'Failed to delete material', 'Error');
    }
  };

  // --- Handlers: Assessments & Question Builder ---
  const handleToggleAssessmentStatus = async (asmt) => {
    const nextStatus = asmt.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      const res = await updateCompetitionAssessment(asmt.id, { status: nextStatus });
      if (res.success) {
        setAssessments(prev => prev.map(a => a.id === asmt.id ? { ...a, status: nextStatus } : a));
      }
    } catch (err) {
      await showError(err.message || 'Failed to toggle assessment status', 'Error');
    }
  };

  const openQuestionBuilder = async (asmt) => {
    setActiveAsmtForQuestions(asmt);
    setLoadingQuestions(true);
    try {
      const res = await getAssessmentQuestions(asmt.id);
      setQuestions(res?.data || []);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const resetQuestionForm = () => {
    setQuestionFormData({
      id: null,
      questionFormat: 'MCQ',
      questionText: '',
      mediaRef: '',
      answerFormat: 'MCQ_OPTIONS',
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
  };

  const handleSaveQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!activeAsmtForQuestions || !questionFormData.questionText.trim()) return;

    const qFormat = (questionFormData.questionFormat || 'MCQ').toUpperCase();
    if (['IMAGE', 'VIDEO', 'AUDIO'].includes(qFormat)) {
      if (isMediaUploading) {
        await showError('Please wait for the media file upload to complete.', 'Upload in Progress');
        return;
      }
      if (!questionFormData.mediaRef || !questionFormData.mediaRef.trim()) {
        const typeName = qFormat === 'IMAGE' ? 'image' : qFormat === 'VIDEO' ? 'video' : 'audio';
        await showError(`Please upload an ${typeName} file for this question.`, 'Media Required');
        return;
      }
    }

    setSavingQuestion(true);
    try {
      const res = await saveAssessmentQuestion(activeAsmtForQuestions.id, questionFormData);
      if (res.success) {
        await showSuccess('Question saved successfully', 'Saved');
        setShowQuestionModal(false);
        const qRes = await getAssessmentQuestions(activeAsmtForQuestions.id);
        setQuestions(qRes?.data || []);
      }
    } catch (err) {
      await showError(err.message || 'Failed to save question', 'Error');
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      const res = await deleteAssessmentQuestion(qId);
      if (res.success) {
        setQuestions(prev => prev.filter(q => q.id !== qId));
      }
    } catch (err) {
      await showError(err.message || 'Failed to delete question', 'Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl relative flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                Competition Management Center
              </h2>
              <p className="text-xs text-slate-500 font-semibold">{competition.title || competition.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full border border-slate-200 cursor-pointer shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto gap-2">
          {[
            { id: 'sets', label: 'Sets & Trainers', icon: Users },
            { id: 'syllabus', label: 'Syllabus', icon: BookOpen },
            { id: 'videos', label: 'Guidance Videos', icon: Video },
            { id: 'materials', label: 'Study Materials', icon: FileText },
            { id: 'assessments', label: 'Assessments & Question Builder', icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setActiveAsmtForQuestions(null);
                }}
                className={`py-3.5 px-4 text-xs font-bold flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isCurrent
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 flex justify-center">
              <InlineSpinner text="Loading competition resources..." />
            </div>
          ) : (
            <>
              {/* TAB 1: SETS & TRAINERS */}
              {activeTab === 'sets' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Assigned Sets & Evaluators (Sets A - D)</h3>
                    <p className="text-xs text-slate-500">
                      Confirmed participants are distributed equally across Sets A, B, C, and D. Assign a trainer to each set.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sets.map(s => (
                      <div key={s.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-xs">
                            {s.code}
                          </span>
                          <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            {s.memberCount || 0} Students
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">Assigned Trainer</label>
                          <select
                            value={s.trainerId || ''}
                            onChange={(e) => handleAssignTrainer(s.code, e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold p-2 text-slate-900 focus:outline-none focus:border-blue-600"
                          >
                            <option value="">Unassigned</option>
                            {trainers.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: SYLLABUS */}
              {activeTab === 'syllabus' && (
                <div className="space-y-5 max-w-xl">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Upload Competition Syllabus (PDF)</h3>
                    <p className="text-xs text-slate-500">Students can view and download this official curriculum document in their portal.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Syllabus Title</label>
                      <input
                        type="text"
                        value={sylTitle}
                        onChange={(e) => setSylTitle(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                        placeholder="e.g. Official Competition Syllabus 2026"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Upload PDF File</label>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleSyllabusFileUpload}
                        disabled={sylUploading}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                      />
                    </div>
                  </div>

                  {syllabus?.viewUrl && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Syllabus Active: {syllabus.fileName || 'Syllabus.pdf'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewingFile({
                          id: syllabus.storedFileId || syllabus.id,
                          url: syllabus.viewUrl,
                          name: syllabus.fileName || syllabus.title,
                          title: syllabus.title,
                          type: syllabus.fileType
                        })}
                        className="text-blue-600 hover:underline inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Preview</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: GUIDANCE VIDEOS */}
              {activeTab === 'videos' && (
                <GuidanceVideoManager
                  competitionId={competition.id}
                  competitionTitle={competition.title}
                />
              )}

              {/* TAB 4: STUDY MATERIALS */}
              {activeTab === 'materials' && (
                <div className="space-y-6">
                  {/* Upload Material Form */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 max-w-xl">
                    <h4 className="text-xs font-black uppercase text-slate-500">Upload Study Material / Handout</h4>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Material Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. Formula Sheet & Practice Set 1"
                        value={newMaterial.title}
                        onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Select File (PDF, DOCX, ZIP)</label>
                      <input
                        type="file"
                        onChange={handleMaterialFileUpload}
                        disabled={materialUploading}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Materials List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-500">Available Materials ({materials.length})</h4>
                    {materials.length === 0 ? (
                      <p className="text-xs text-slate-400">No materials uploaded yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {materials.map(m => (
                          <div key={m.id} className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-2xs">
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-xs text-slate-900 truncate">{m.title}</p>
                              <p className="text-[10px] text-slate-400">{m.fileName || 'Document'}</p>
                            </div>
                            <div className="flex items-center space-x-1">
                              {m.viewUrl && (
                                <button
                                  type="button"
                                  onClick={() => setViewingFile({
                                    id: m.storedFileId || m.id,
                                    url: m.viewUrl,
                                    name: m.fileName || m.title,
                                    title: m.title,
                                    type: m.fileType
                                  })}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                  title="Preview Material"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMaterial(m.id)}
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
                </div>
              )}

              {/* TAB 5: ASSESSMENTS & QUESTION BUILDER */}
              {activeTab === 'assessments' && (
                <div className="space-y-6">
                  {!activeAsmtForQuestions ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-slate-900">Assessment Slots (35 Test Series, 4 Mocks, 1 Final)</h3>
                          <p className="text-xs text-slate-500">Configure status and manage questions for each assessment slot.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                        {assessments.map(a => (
                          <div key={a.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                a.type === 'FINAL' ? 'bg-rose-100 text-rose-700' : a.type === 'MOCK' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {a.type} #{a.sequenceNo}
                              </span>
                              <button
                                onClick={() => handleToggleAssessmentStatus(a)}
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full cursor-pointer transition ${
                                  a.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {a.status}
                              </button>
                            </div>

                            <div>
                              <h4 className="font-bold text-xs text-slate-900">{a.title}</h4>
                              <p className="text-[11px] text-slate-500">{a.durationMinutes} min • {a.totalMarks} marks</p>
                            </div>

                            <button
                              onClick={() => openQuestionBuilder(a)}
                              className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1"
                            >
                              <span>Manage Questions</span>
                              <ArrowRight className="w-3.5 h-3.5 text-blue-600 ml-1" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Question Builder View for Selected Assessment */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div>
                          <button
                            onClick={() => setActiveAsmtForQuestions(null)}
                            className="text-xs font-bold text-blue-600 hover:underline mb-1"
                          >
                            ← Back to all assessment slots
                          </button>
                          <h3 className="text-base font-black text-slate-900">
                            Questions for {activeAsmtForQuestions.title} ({activeAsmtForQuestions.type} #{activeAsmtForQuestions.sequenceNo})
                          </h3>
                        </div>

                        <button
                          onClick={() => {
                            resetQuestionForm();
                            setShowQuestionModal(true);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Question</span>
                        </button>
                      </div>

                      {loadingQuestions ? (
                        <div className="py-8 flex justify-center">
                          <InlineSpinner text="Loading questions..." />
                        </div>
                      ) : questions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                          No questions authored yet for this assessment slot. Click "Add Question" to create one.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {questions.map((q, idx) => (
                            <div key={q.id || idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                    {q.questionFormat}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                    {q.answerFormat}
                                  </span>
                                  <span className="text-xs font-bold text-slate-500">({q.marks} Marks)</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* SUB-MODAL: Add / Edit Question Form */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">Add Question to Assessment</h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestionSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Question Format</label>
                  <select
                    value={questionFormData.questionFormat}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, questionFormat: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="MCQ">Standard Text MCQ</option>
                    <option value="IMAGE">Image Prompt (Storage)</option>
                    <option value="AUDIO">Audio Prompt (Storage)</option>
                    <option value="VIDEO">Video Prompt (Bunny Stream)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Answer Format</label>
                  <select
                    value={questionFormData.answerFormat}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, answerFormat: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="MCQ_OPTIONS">MCQ Options</option>
                    <option value="VOICE">Voice / Audio Recording</option>
                  </select>
                </div>
              </div>

              {questionFormData.questionFormat !== 'MCQ' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Question Media Prompt ({questionFormData.questionFormat === 'AUDIO' ? 'Audio' : questionFormData.questionFormat === 'IMAGE' ? 'Image' : 'Video'} Upload) *
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
                            isVideo: questionFormData.questionFormat === 'VIDEO',
                            mediaType: questionFormData.questionFormat === 'IMAGE' ? 'image' : questionFormData.questionFormat === 'VIDEO' ? 'video' : questionFormData.questionFormat === 'AUDIO' ? 'audio' : null,
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
                        ? 'Upload audio question prompt. Audio is stored via Bunny Storage.'
                        : questionFormData.questionFormat === 'IMAGE'
                        ? 'Upload image question prompt (.png, .jpg, .webp). Stored via Bunny Storage.'
                        : 'Upload video question prompt. Videos stream via Bunny Stream.'
                    }
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Question Prompt / Instructions *</label>
                <textarea
                  required
                  rows={3}
                  value={questionFormData.questionText}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, questionText: e.target.value })}
                  placeholder="Enter the question text or speech prompt..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

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

              {/* Options Builder for MCQ */}
              {questionFormData.answerFormat === 'MCQ_OPTIONS' && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="block font-bold text-slate-700">Options (Select the correct option):</label>
                  {questionFormData.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="correctOption"
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

              {/* Criteria Builder for Voice */}
              {questionFormData.answerFormat === 'VOICE' && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="block font-bold text-slate-700">Trainer Evaluation Criteria:</label>
                  {questionFormData.evaluationCriteria.map((crit, cIdx) => (
                    <div key={cIdx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Criteria Title"
                        value={crit.title}
                        onChange={(e) => {
                          const updated = [...questionFormData.evaluationCriteria];
                          updated[cIdx] = { ...updated[cIdx], title: e.target.value };
                          setQuestionFormData({ ...questionFormData, evaluationCriteria: updated });
                        }}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Max Marks"
                        value={crit.maxMarks}
                        onChange={(e) => {
                          const updated = [...questionFormData.evaluationCriteria];
                          updated[cIdx] = { ...updated[cIdx], maxMarks: Number(e.target.value) };
                          setQuestionFormData({ ...questionFormData, evaluationCriteria: updated });
                        }}
                        className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Explanation / Solution Note (Optional)</label>
                <textarea
                  rows={2}
                  value={questionFormData.explanation}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, explanation: e.target.value })}
                  placeholder="Solution explanation visible after answer review is enabled..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                >
                  <span>Save Question</span>
                </ButtonSpinner>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal File Viewer Modal (Tasks K1 & K2) */}
      <UniversalFileViewerModal
        isOpen={Boolean(viewingFile)}
        onClose={() => setViewingFile(null)}
        file={viewingFile}
        hideDownload={false}
      />
    </div>
  );
}
