import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Video, FileText, Layers, Trash2, Edit, X, 
  ExternalLink, Image as ImageIcon, AlertCircle,
  Music, Download, GripVertical, ChevronUp, ChevronDown, Eye
} from 'lucide-react';
import * as tus from 'tus-js-client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { parseJsonField, getCourseById, addModule, updateModule, deleteModule, reorderModules } from '../../api/courseApi';
import PageLoader from '../common/PageLoader';
import { uploadFile, resolveFileUrl, openFileWithSignedLink } from '../../api/fileApi';
import { createVideoUploadSession, getVideoDetails } from '../../api/videoApi';
import { useDialog } from '../../context/DialogContext';
import ConfirmModal from '../common/ConfirmModal';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';

const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt',
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'mp4', 'mov', 'avi', 'webm',
  'mp3', 'wav', 'm4a'
];

function SortableModuleCard({
  mod,
  index,
  totalModules,
  moduleVideoStatuses,
  openEditModal,
  setDeleteModalData,
  onMoveUp,
  onMoveDown,
  renderFileIcon,
  onPreviewFile,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mod.id || `mod-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  const notes = mod.notesFile || mod.notesPdf;
  const worksheet = mod.worksheetFile || mod.activitySheetPdf;
  const assignment = mod.assignmentFile || mod.assignmentPdf;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-3xl border ${isDragging ? 'border-blue-500 shadow-xl' : 'border-slate-200/80 shadow-md'} overflow-hidden space-y-4`}
    >
      {/* Module Header Bar */}
      <div className="bg-slate-900 text-white p-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          {/* Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors shrink-0"
            title="Drag to reorder"
            aria-label={`Drag module ${index + 1} to reorder`}
          >
            <GripVertical className="w-5 h-5" />
          </button>

          {/* Up / Down Arrows (fallback) */}
          <div className="flex flex-col space-y-0.5 shrink-0">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              title="Move Up"
              aria-label={`Move module ${index + 1} up`}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === totalModules - 1}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              title="Move Down"
              aria-label={`Move module ${index + 1} down`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-black text-xs shrink-0 tracking-wide">
            Module {index + 1}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black tracking-tight">{mod.title}</h3>
              {(() => {
                const vInfo = parseJsonField(mod.videoStorageRef);
                const rawStatus = moduleVideoStatuses[mod.id] || vInfo?.status;
                if (!vInfo && !rawStatus) return null;
                const statusNorm = typeof rawStatus === 'string' ? rawStatus : 'Processing';
                return (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    statusNorm === 'Ready'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : statusNorm === 'Failed'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : statusNorm === 'Uploading'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                  }`}>
                    <Video className="w-3 h-3" />
                    <span>Video: {statusNorm}</span>
                    {mod.duration && statusNorm === 'Ready' && <span className="opacity-80">({mod.duration})</span>}
                  </span>
                );
              })()}
            </div>
            {mod.description && <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{mod.description}</p>}
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <button
            onClick={() => openEditModal(mod)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 text-blue-400" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeleteModalData(mod)}
            className="bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Module Body Content */}
      <div className="p-6 pt-2 space-y-4">
        {/* Thumbnail Preview & URL Link Row */}
        <div className="flex flex-col md:flex-row gap-4 items-start border-b border-slate-100 pb-4">
          {mod.thumbnail ? (
            <div className="w-32 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
              <img
                src={resolveFileUrl(mod.thumbnail)}
                alt={mod.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/assets/course-placeholder.svg';
                }}
              />
            </div>
          ) : (
            <div className="w-32 h-24 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-[10px] font-semibold shrink-0">
              <ImageIcon className="w-5 h-5 mb-1" />
              No Thumbnail
            </div>
          )}

          <div className="flex-1 space-y-2 text-xs">
            {mod.url && (
              <div className="flex items-center space-x-2 text-blue-600 font-bold">
                <ExternalLink className="w-4 h-4 shrink-0" />
                <a href={mod.url} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                  {mod.url}
                </a>
              </div>
            )}
            {mod.description && (
              <p className="text-slate-600 leading-relaxed font-medium">{mod.description}</p>
            )}
          </div>
        </div>

        {/* Module Resources Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Notes */}
          <div className={`p-4 rounded-2xl border ${notes ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'} space-y-1.5`}>
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-slate-800 flex items-center gap-1.5">
                {renderFileIcon(notes?.type)}
                Notes
              </span>
              {notes && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Attached</span>}
            </div>
            {notes ? (
              <div className="text-[11px] font-bold text-slate-700 truncate space-y-1">
                <div>📄 {notes.name} {notes.size ? `(${notes.size})` : ''}</div>
                {notes.fileUrl && (
                  <button
                    type="button"
                    onClick={() => onPreviewFile && onPreviewFile({ url: notes.fileUrl, name: notes.name, type: notes.type, size: notes.size })}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </button>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-medium italic">No Notes attached</div>
            )}
          </div>

          {/* Worksheet */}
          <div className={`p-4 rounded-2xl border ${worksheet ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-200'} space-y-1.5`}>
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-slate-800 flex items-center gap-1.5">
                {renderFileIcon(worksheet?.type)}
                Worksheet
              </span>
              {worksheet && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">Attached</span>}
            </div>
            {worksheet ? (
              <div className="text-[11px] font-bold text-slate-700 truncate space-y-1">
                <div>📑 {worksheet.name} {worksheet.size ? `(${worksheet.size})` : ''}</div>
                {worksheet.fileUrl && (
                  <button
                    type="button"
                    onClick={() => onPreviewFile && onPreviewFile({ url: worksheet.fileUrl, name: worksheet.name, type: worksheet.type, size: worksheet.size })}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </button>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-medium italic">No Worksheet attached</div>
            )}
          </div>

          {/* Assignment */}
          <div className={`p-4 rounded-2xl border ${assignment ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'} space-y-1.5`}>
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-slate-800 flex items-center gap-1.5">
                {renderFileIcon(assignment?.type)}
                Assignment
              </span>
              {assignment && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Attached</span>}
            </div>
            {assignment ? (
              <div className="text-[11px] font-bold text-slate-700 truncate space-y-1">
                <div>📝 {assignment.name} {assignment.size ? `(${assignment.size})` : ''}</div>
                {assignment.fileUrl && (
                  <button
                    type="button"
                    onClick={() => onPreviewFile && onPreviewFile({ url: assignment.fileUrl, name: assignment.name, type: assignment.type, size: assignment.size })}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </button>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-medium italic">No Assignment attached</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CourseContentPage({ courseId: propCourseId, setActiveScreen }) {
  const { courseId: paramCourseId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useDialog();
  const courseId = propCourseId || paramCourseId;
  const [course, setCourse] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [fileErrors, setFileErrors] = useState({});
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [previewFile, setPreviewFile] = useState(null);

  const [videoUploadState, setVideoUploadState] = useState({
    isUploading: false,
    progress: 0,
    error: '',
    tusUpload: null,
    videoId: '',
    status: '',
    duration: '',
    thumbnail: ''
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    videoId: '',
    thumbnail: '',
    notesFile: null,
    worksheetFile: null,
    assignmentFile: null
  });

  const [moduleVideoStatuses, setModuleVideoStatuses] = useState({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const syncModuleVideoStatuses = (modulesList) => {
    if (!modulesList || modulesList.length === 0) return;
    const initial = {};
    for (const mod of modulesList) {
      if (!mod.videoStorageRef) continue;
      const parsed = parseJsonField(mod.videoStorageRef);
      const vId = parsed?.videoId || (typeof mod.videoStorageRef === 'string' && !mod.videoStorageRef.startsWith('{') ? mod.videoStorageRef : null);
      if (vId) {
        initial[mod.id] = parsed?.status || 'Processing';
        getVideoDetails(vId).then(res => {
          if (res.success && res.data) {
            const liveStatus = res.data.statusLabel || (res.data.status === 3 ? 'Ready' : (res.data.status === 4 ? 'Failed' : 'Processing'));
            setModuleVideoStatuses(prev => ({ ...prev, [mod.id]: liveStatus }));
          }
        }).catch(() => {});
      }
    }
    setModuleVideoStatuses(prev => ({ ...prev, ...initial }));
  };

  const loadCourse = async () => {
    if (courseId) {
      const res = await getCourseById(courseId);
      if (res.data) {
        const sortedModules = [...(res.data.modules || [])].sort((a, b) => ((a.moduleOrder ?? a.module_order ?? 0) - (b.moduleOrder ?? b.module_order ?? 0)));
        setCourse({ ...res.data, modules: sortedModules });
        if (sortedModules.length > 0) {
          syncModuleVideoStatuses(sortedModules);
        }
      }
    }
  };

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  if (!course) {
    return <PageLoader fullPage message="Loading course modules..." />;
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      videoId: '',
      thumbnail: '',
      notesFile: null,
      worksheetFile: null,
      assignmentFile: null
    });
    setVideoUploadState({
      isUploading: false,
      progress: 0,
      error: '',
      tusUpload: null,
      videoId: '',
      status: '',
      duration: '',
      thumbnail: ''
    });
    setFileErrors({});
  };

  const getFileCategoryLabel = (fieldName) => {
    if (fieldName === 'notesFile') return 'Notes';
    if (fieldName === 'worksheetFile') return 'Worksheet';
    if (fieldName === 'assignmentFile') return 'Assignment';
    return 'Resource';
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setFileErrors(prev => ({ 
        ...prev, 
        [fieldName]: `Unsupported file type (.${ext}). Supported formats: ${ALLOWED_EXTENSIONS.join(', ')}` 
      }));
      e.target.value = '';
      return;
    }

    const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
    if (file.size > MAX_SIZE) {
      setFileErrors(prev => ({ ...prev, [fieldName]: 'File size must be 100 MB or less.' }));
      e.target.value = '';
      return;
    }

    setFileErrors(prev => ({ ...prev, [fieldName]: '' }));
    setUploadingFiles(prev => ({ ...prev, [fieldName]: true }));

    const category = getFileCategoryLabel(fieldName).toLowerCase();
    try {
      const res = await uploadFile(file, category);
      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }));

      setFormData(prev => ({
        ...prev,
        [fieldName]: {
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          type: ext,
          uploadedAt: new Date().toLocaleDateString('en-GB'),
          fileUrl: res.url,
          category: getFileCategoryLabel(fieldName)
        }
      }));
    } catch (err) {
      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }));
      setFileErrors(prev => ({ ...prev, [fieldName]: err.message || 'Upload failed' }));
    }
  };

  const handleVideoUploadSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validVideoExts = ['mp4', 'mov', 'webm', 'mkv'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !validVideoExts.includes(ext)) {
      setFileErrors(prev => ({ ...prev, video: 'Please select a valid video file (.mp4, .mov, .webm)' }));
      e.target.value = '';
      return;
    }

    setFileErrors(prev => ({ ...prev, video: '' }));
    setVideoUploadState(prev => ({
      ...prev,
      isUploading: true,
      progress: 0,
      error: ''
    }));

    try {
      const sessionRes = await createVideoUploadSession({
        title: formData.title || file.name,
        courseId: course.id,
        moduleId: editingModule?.id
      });

      if (!sessionRes.success || !sessionRes.data) {
        throw new Error(sessionRes.message || 'Failed to initialize Bunny upload session');
      }

      const { videoId, libraryId, tusEndpoint, authorizationSignature, authorizationExpire } = sessionRes.data;

      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 3000, 5000],
        headers: {
          AuthorizationSignature: authorizationSignature,
          AuthorizationExpire: String(authorizationExpire),
          VideoId: videoId,
          LibraryId: String(libraryId)
        },
        metadata: {
          filename: file.name,
          filetype: file.type
        },
        onError: (err) => {
          setVideoUploadState(prev => ({
            ...prev,
            isUploading: false,
            error: err.message || 'TUS Upload failed'
          }));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          setVideoUploadState(prev => ({ ...prev, progress: pct }));
        },
        onSuccess: () => {
          setVideoUploadState(prev => ({
            ...prev,
            isUploading: false,
            videoId,
            status: 'Processing'
          }));
          setFormData(prev => ({ ...prev, videoId }));
          pollVideoStatus(videoId);
        }
      });

      setVideoUploadState(prev => ({ ...prev, tusUpload: upload }));
      upload.start();
    } catch (err) {
      setVideoUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: err.message || 'Video upload session creation failed'
      }));
    }
  };

  const handleCancelVideoUpload = () => {
    if (videoUploadState.tusUpload) {
      videoUploadState.tusUpload.abort();
    }
    setVideoUploadState({
      isUploading: false,
      progress: 0,
      error: 'Upload cancelled by user',
      tusUpload: null,
      videoId: '',
      status: '',
      duration: '',
      thumbnail: ''
    });
  };

  const pollVideoStatus = async (vId) => {
    if (!vId) return;
    try {
      const res = await getVideoDetails(vId);
      if (res.success && res.data) {
        const video = res.data;
        const statusLabel = video.statusLabel || (video.status === 3 ? 'Ready' : 'Processing');
        setVideoUploadState(prev => ({
          ...prev,
          status: statusLabel,
          duration: video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${video.durationSeconds % 60 < 10 ? '0' : ''}${video.durationSeconds % 60}` : '',
          thumbnail: video.thumbnailUrl || ''
        }));
        if (video.status !== 3 && video.status !== 4) {
          setTimeout(() => pollVideoStatus(vId), 4000);
        }
      }
    } catch (err) {
      console.warn('Poll video status failed:', err);
    }
  };

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const isImage = validTypes.includes(file.type) || /\.(jpg|jpeg|png|webp)$/i.test(file.name);

    if (!isImage) {
      setFileErrors(prev => ({ ...prev, thumbnail: 'Only JPG, JPEG, PNG, or WebP images are accepted.' }));
      e.target.value = '';
      return;
    }

    setFileErrors(prev => ({ ...prev, thumbnail: '' }));
    setUploadingFiles(prev => ({ ...prev, thumbnail: true }));

    try {
      const res = await uploadFile(file, 'thumbnail');
      setUploadingFiles(prev => ({ ...prev, thumbnail: false }));
      setFormData(prev => ({
        ...prev,
        thumbnail: res.url
      }));
    } catch (err) {
      setUploadingFiles(prev => ({ ...prev, thumbnail: false }));
      setFileErrors(prev => ({ ...prev, thumbnail: err.message || 'Image upload failed' }));
    }
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const isVideoReady = videoUploadState.status === 'Ready' || videoUploadState.status === 'Transcoded' || videoUploadState.status === 'Finished';
    const computedDuration = (isVideoReady && videoUploadState.duration)
      ? videoUploadState.duration
      : (editingModule?.duration && isVideoReady ? editingModule.duration : '');

    const videoStatus = videoUploadState.status || (videoUploadState.isUploading ? 'Uploading' : (formData.videoId ? 'Ready' : ''));

    // Preserve existing video reference if not explicitly replaced during edit
    const effectiveVideoId = formData.videoId || (editingModule ? (() => {
      const parsed = parseJsonField(editingModule.videoStorageRef);
      return parsed?.videoId || (typeof editingModule.videoStorageRef === 'string' && !editingModule.videoStorageRef.startsWith('{') ? editingModule.videoStorageRef : '');
    })() : '');

    const videoStorageRef = effectiveVideoId ? JSON.stringify({
      videoId: effectiveVideoId,
      status: videoStatus || 'Ready'
    }) : (editingModule?.videoStorageRef || null);

    const payload = {
      title: formData.title,
      description: formData.description,
      duration: computedDuration,
      videoStorageRef,
      thumbnail: formData.thumbnail || editingModule?.thumbnailUrl || '',
      thumbnailUrl: formData.thumbnail || editingModule?.thumbnailUrl || '',
      notesFile: formData.notesFile,
      notesFileUrl: formData.notesFile?.fileUrl || (typeof formData.notesFile === 'string' ? formData.notesFile : (editingModule?.notesFileUrl || null)),
      notesFileName: formData.notesFile?.name || editingModule?.notesFileName || null,
      worksheetFile: formData.worksheetFile,
      worksheetFileUrl: formData.worksheetFile?.fileUrl || (typeof formData.worksheetFile === 'string' ? formData.worksheetFile : (editingModule?.worksheetFileUrl || null)),
      worksheetFileName: formData.worksheetFile?.name || editingModule?.worksheetFileName || null,
      assignmentFile: formData.assignmentFile,
      assignmentFileUrl: formData.assignmentFile?.fileUrl || (typeof formData.assignmentFile === 'string' ? formData.assignmentFile : (editingModule?.assignmentFileUrl || null)),
      assignmentFileName: formData.assignmentFile?.name || editingModule?.assignmentFileName || null
    };

    if (editingModule) {
      const res = await updateModule(course.id, editingModule.id, payload);
      if (res.success) {
        setEditingModule(null);
        resetForm();
        await showSuccess(res.message || 'Module updated successfully', 'Module Updated');
        loadCourse();
      } else {
        await showError(res.message || 'Failed to update module', 'Update Error');
      }
    } else {
      const res = await addModule(course.id, payload);
      if (res.success) {
        setShowAddModal(false);
        resetForm();
        await showSuccess(res.message || 'Module added successfully', 'Module Added');
        loadCourse();
      } else {
        await showError(res.message || 'Failed to add module', 'Creation Error');
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteModalData) {
      const res = await deleteModule(course.id, deleteModalData.id);
      if (res.success) {
        setDeleteModalData(null);
        await showSuccess(res.message || 'Module deleted successfully', 'Module Deleted');
        loadCourse();
      } else {
        await showError(res.message || 'Failed to delete module', 'Delete Error');
      }
    }
  };

  const openEditModal = (mod) => {
    setEditingModule(mod);
    const videoRef = parseJsonField(mod.videoStorageRef);
    let existingVideoId = '';
    if (videoRef && typeof videoRef === 'object') {
      existingVideoId = videoRef.videoId || '';
    } else if (typeof mod.videoStorageRef === 'string') {
      existingVideoId = mod.videoStorageRef.startsWith('{') ? '' : mod.videoStorageRef;
    }

    setFormData({
      title: mod.title || '',
      description: mod.description || '',
      videoId: typeof existingVideoId === 'string' ? existingVideoId : '',
      thumbnail: mod.thumbnailUrl || mod.thumbnail || '',
      notesFile: mod.notesFile || mod.notesPdf || (mod.notesFileUrl ? { fileUrl: mod.notesFileUrl, name: mod.notesFileName || 'Notes Document' } : null),
      worksheetFile: mod.worksheetFile || mod.activitySheetPdf || (mod.worksheetFileUrl ? { fileUrl: mod.worksheetFileUrl, name: mod.worksheetFileName || 'Worksheet Document' } : null),
      assignmentFile: mod.assignmentFile || mod.assignmentPdf || (mod.assignmentFileUrl ? { fileUrl: mod.assignmentFileUrl, name: mod.assignmentFileName || 'Assignment Document' } : null)
    });

    if (existingVideoId && typeof existingVideoId === 'string') {
      setVideoUploadState(prev => ({ ...prev, videoId: existingVideoId }));
      pollVideoStatus(existingVideoId);
    }
    setFileErrors({});
  };

  const isOnlineMode = course.mode === 'Online';

  const renderFileIcon = (type) => {
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(type)) return <ImageIcon className="w-4 h-4 text-purple-600 shrink-0" />;
    if (['mp4', 'mov', 'avi', 'webm'].includes(type)) return <Video className="w-4 h-4 text-blue-600 shrink-0" />;
    if (['mp3', 'wav', 'm4a'].includes(type)) return <Music className="w-4 h-4 text-emerald-600 shrink-0" />;
    return <FileText className="w-4 h-4 text-amber-600 shrink-0" />;
  };

  const handleMoveModule = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (!course?.modules || targetIndex < 0 || targetIndex >= course.modules.length) return;

    const newModules = arrayMove(course.modules, index, targetIndex);
    setCourse(prev => ({ ...prev, modules: newModules }));

    const moduleIds = newModules.map(m => m.id);
    const res = await reorderModules(course.id, moduleIds);
    if (!res.success) {
      await showError(res.message || 'Failed to reorder modules', 'Reorder Error');
      loadCourse();
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !course?.modules) return;

    const oldIndex = course.modules.findIndex(m => (m.id || m) === active.id);
    const newIndex = course.modules.findIndex(m => (m.id || m) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newModules = arrayMove(course.modules, oldIndex, newIndex);
    setCourse(prev => ({ ...prev, modules: newModules }));

    const moduleIds = newModules.map(m => m.id);
    const res = await reorderModules(course.id, moduleIds);
    if (!res.success) {
      await showError(res.message || 'Failed to reorder modules', 'Reorder Error');
      loadCourse();
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <button
        onClick={() => {
          if (setActiveScreen) setActiveScreen('admin-manage-courses');
          navigate('/admin/courses');
        }}
        className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Course Management</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Course Modules: {course.title}</h1>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              course.mode === 'Online' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
              course.mode === 'Recorded' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
              'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}>
              {course.mode || 'Online'} Mode
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">Add, edit, and organize individual modules and study resources for this course.</p>
        </div>

        {!isOnlineMode && (
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md flex items-center space-x-2 text-xs self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Module</span>
          </button>
        )}
      </div>

      {/* Online Mode Notice Banner */}
      {isOnlineMode && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-3xl text-amber-900 text-xs font-semibold flex items-center space-x-3 shadow-xs">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <strong className="block text-sm font-extrabold text-amber-950">Modules are not available for Online mode courses (Live sessions only).</strong>
            <span>Online mode courses use live Google Meet schedules. Switch the course mode to <strong>Recorded</strong> or <strong>Hybrid</strong> in Edit Course if you wish to attach recorded modules and files.</span>
          </div>
        </div>
      )}

      {/* Modules List */}
      {!isOnlineMode && (
        <div className="space-y-6">
          {(!course.modules || course.modules.length === 0) ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3 shadow-xs">
              <Layers className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-extrabold text-slate-800">No modules created yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click <strong className="text-blue-600">"Add New Module"</strong> above to upload notes, worksheets, assignments, and video links for {course.title}.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={course.modules.map((m, idx) => m.id || `mod-${idx}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-6">
                  {course.modules.map((mod, index) => (
                    <SortableModuleCard
                      key={mod.id || index}
                      mod={mod}
                      index={index}
                      totalModules={course.modules.length}
                      moduleVideoStatuses={moduleVideoStatuses}
                      openEditModal={openEditModal}
                      setDeleteModalData={setDeleteModalData}
                      onMoveUp={() => handleMoveModule(index, 'up')}
                      onMoveDown={() => handleMoveModule(index, 'down')}
                      renderFileIcon={renderFileIcon}
                      onPreviewFile={setPreviewFile}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Add / Edit Module Modal */}
      {(showAddModal || editingModule) && !isOnlineMode && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative space-y-5 max-h-[90dvh] overflow-y-auto text-xs">
            <button
              onClick={() => { setShowAddModal(false); setEditingModule(null); }}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-slate-900">
              {editingModule ? `Edit Module: ${editingModule.title}` : `Add Module to ${course.title}`}
            </h3>

            <form onSubmit={handleSaveModule} className="space-y-4">
              
              {/* 1. Module Title */}
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Module Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Module 1: Introduction to Communication"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* 2. Module Description */}
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Module Description</label>
                <textarea
                  rows={2}
                  placeholder="Overview of topics and objectives covered in this module..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* 3. Lesson Video Upload (Bunny TUS Direct Stream) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <label className="block font-extrabold text-slate-800">Upload MP4 Video</label>
                
                <div>
                  <input
                    type="file"
                    accept="video/mp4,video/mov,video/webm"
                    onChange={handleVideoUploadSelect}
                    disabled={videoUploadState.isUploading}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium cursor-pointer"
                  />
                </div>

                {videoUploadState.isUploading && (
                  <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Uploading video to Bunny CDN...</span>
                      <span>{videoUploadState.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-2 transition-all duration-300" style={{ width: `${videoUploadState.progress}%` }} />
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelVideoUpload}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Cancel Upload
                    </button>
                  </div>
                )}

                {videoUploadState.error && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {videoUploadState.error}
                  </p>
                )}

                {formData.videoId && !videoUploadState.isUploading && (
                  <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs">
                    <div>
                      <p className="font-bold text-emerald-900">✓ Video Linked (ID: {formData.videoId})</p>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Status: <span className="font-bold uppercase">{videoUploadState.status || 'Ready'}</span>
                        {videoUploadState.duration && ` • Duration: ${videoUploadState.duration}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, videoId: '' }));
                        setVideoUploadState(prev => ({ ...prev, videoId: '', status: '' }));
                      }}
                      className="text-rose-600 font-bold hover:underline text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Thumbnail Image Upload */}
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">Thumbnail Image (JPG/JPEG/PNG/WebP)</label>
                <div className="flex items-center gap-3">
                  {formData.thumbnail && (
                    <div className="relative w-16 h-16 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                      <img
                        src={resolveFileUrl(formData.thumbnail)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/assets/course-placeholder.svg';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, thumbnail: '' })}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-rose-600 text-white rounded-full"
                        title="Remove Image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleThumbnailUpload}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium cursor-pointer"
                  />
                </div>
                {fileErrors.thumbnail && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {fileErrors.thumbnail}
                  </p>
                )}
              </div>

              {/* 5. Notes */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-extrabold text-slate-800">Notes (Max 100 MB, All Formats)</label>
                  <span className="text-[10px] text-slate-400 font-semibold">.pdf, .doc, .docx, .ppt, .xls, .jpg, .png, .mp4, etc.</span>
                </div>
                {formData.notesFile ? (
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-bold">
                    <span>📄 {formData.notesFile.name} ({formData.notesFile.size})</span>
                    <div className="flex items-center gap-2">
                      {formData.notesFile.fileUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: formData.notesFile.fileUrl, name: formData.notesFile.name, type: formData.notesFile.type, size: formData.notesFile.size })}
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, notesFile: null })}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'notesFile')}
                    className="w-full text-xs font-medium cursor-pointer"
                  />
                )}
                {fileErrors.notesFile && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {fileErrors.notesFile}
                  </p>
                )}
              </div>

              {/* 6. Worksheet */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-extrabold text-slate-800">Worksheet (Max 100 MB, All Formats)</label>
                  <span className="text-[10px] text-slate-400 font-semibold">.pdf, .doc, .docx, .ppt, .xls, .jpg, .png, .mp4, etc.</span>
                </div>
                {formData.worksheetFile ? (
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-bold">
                    <span>📑 {formData.worksheetFile.name} ({formData.worksheetFile.size})</span>
                    <div className="flex items-center gap-2">
                      {formData.worksheetFile.fileUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: formData.worksheetFile.fileUrl, name: formData.worksheetFile.name, type: formData.worksheetFile.type, size: formData.worksheetFile.size })}
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, worksheetFile: null })}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'worksheetFile')}
                    className="w-full text-xs font-medium cursor-pointer"
                  />
                )}
                {fileErrors.worksheetFile && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {fileErrors.worksheetFile}
                  </p>
                )}
              </div>

              {/* 7. Assignment */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-extrabold text-slate-800">Assignment (Max 100 MB, All Formats)</label>
                  <span className="text-[10px] text-slate-400 font-semibold">.pdf, .doc, .docx, .ppt, .xls, .jpg, .png, .mp4, etc.</span>
                </div>
                {formData.assignmentFile ? (
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-bold">
                    <span>📝 {formData.assignmentFile.name} ({formData.assignmentFile.size})</span>
                    <div className="flex items-center gap-2">
                      {formData.assignmentFile.fileUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ url: formData.assignmentFile.fileUrl, name: formData.assignmentFile.name, type: formData.assignmentFile.type, size: formData.assignmentFile.size })}
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, assignmentFile: null })}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'assignmentFile')}
                    className="w-full text-xs font-medium cursor-pointer"
                  />
                )}
                {fileErrors.assignmentFile && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {fileErrors.assignmentFile}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={videoUploadState.isUploading || Object.values(uploadingFiles).some(Boolean)}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl shadow-lg transition-transform text-xs mt-2 cursor-pointer"
              >
                {videoUploadState.isUploading ? 'Uploading Video...' : editingModule ? 'Save Changes' : 'Save Module'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteModalData)}
        title="Delete Module"
        message={`Are you sure you want to delete module "${deleteModalData?.title}"? All attached files and links for this module will be removed.`}
        confirmText="Delete Module"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalData(null)}
      />

      {/* Universal File Viewer Modal */}
      <UniversalFileViewerModal
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
        hideDownload={false}
      />

    </div>
  );
}

