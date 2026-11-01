import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Video, Plus, Trash2, Edit2, Upload, Play, Eye, X, 
  ChevronUp, ChevronDown, CheckCircle2, AlertCircle, Film, RefreshCw, FileText
} from 'lucide-react';
import { 
  getCompetitionGuidanceVideos,
  uploadCompetitionGuidanceVideo,
  updateCompetitionGuidanceVideo,
  replaceCompetitionGuidanceVideo,
  deleteCompetitionGuidanceVideo,
  reorderCompetitionGuidanceVideos
} from '../../api/competitionApi';
import SafeVideo from '../common/SafeVideo';
import ButtonSpinner from '../common/ButtonSpinner';
import InlineSpinner from '../common/InlineSpinner';
import { useDialog } from '../../context/DialogContext';

/**
 * Dedicated Guidance Videos manager component with dynamic Caption + Video file pairs,
 * Bunny Stream backend upload, de-duplication, inline editing, replacement, and reordering.
 */
export default function GuidanceVideoManager({ competitionId, competitionTitle = '' }) {
  const { showSuccess, showError, showWarning, confirm } = useDialog();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Dynamic pair draft rows: array of { id, caption, file, previewUrl, error, progress }
  const [draftRows, setDraftRows] = useState([
    { id: 'draft_1', caption: '', file: null, order: 1, progress: 0 }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(-1);

  // Modals
  const [previewVideo, setPreviewVideo] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null); // { id, caption, sortOrder }
  const [savingCaption, setSavingCaption] = useState(false);

  const [replacingVideo, setReplacingVideo] = useState(null); // { id, caption }
  const [replaceFile, setReplaceFile] = useState(null);
  const [isReplacing, setIsReplacing] = useState(false);

  useEffect(() => {
    if (!competitionId) return;
    loadVideos();
  }, [competitionId]);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const res = await getCompetitionGuidanceVideos(competitionId);
      if (res && res.success) {
        // De-duplicate strictly by Bunny video GUID / ID before setting state
        const rawList = res.data || [];
        const seenBunnyIds = new Set();
        const deduped = [];
        for (const v of rawList) {
          const key = v.bunnyVideoId || v.id;
          if (key && !seenBunnyIds.has(key)) {
            seenBunnyIds.add(key);
            deduped.push(v);
          }
        }
        // Sort by sortOrder
        deduped.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setVideos(deduped);
      } else {
        setVideos([]);
      }
    } catch (err) {
      console.error('Failed to load guidance videos:', err);
      showError('Failed to load guidance videos');
    } finally {
      setLoading(false);
    }
  };

  // --- Dynamic Draft Pair Handlers ---
  const handleAddDraftRow = () => {
    const newId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nextOrder = videos.length + draftRows.length + 1;
    setDraftRows(prev => [...prev, { id: newId, caption: '', file: null, order: nextOrder, progress: 0 }]);
  };

  const handleRemoveDraftRow = (id) => {
    setDraftRows(prev => {
      const remaining = prev.filter(r => r.id !== id);
      return remaining.length > 0 ? remaining : [{ id: `draft_${Date.now()}`, caption: '', file: null, order: videos.length + 1, progress: 0 }];
    });
  };

  const handleRowChange = (id, field, value) => {
    setDraftRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleRowFileChange = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation: MP4, WebM, MOV
    const lowerName = file.name.toLowerCase();
    const isValidFormat = lowerName.endsWith('.mp4') || lowerName.endsWith('.webm') || lowerName.endsWith('.mov') || file.type.startsWith('video/');
    if (!isValidFormat) {
      showWarning('Only video files (.mp4, .webm, .mov) are allowed.', 'Invalid Format');
      e.target.value = '';
      return;
    }

    // Max size: 500 MB
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      showWarning('Video file size exceeds maximum limit of 500 MB.', 'File Too Large');
      e.target.value = '';
      return;
    }

    setDraftRows(prev => prev.map(r => {
      if (r.id === id) {
        // If caption is empty, default it from file name
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        return {
          ...r,
          file,
          fileName: file.name,
          caption: r.caption ? r.caption : cleanName
        };
      }
      return r;
    }));
  };

  // --- Upload Draft Rows ---
  const handleUploadAllDrafts = async () => {
    // Filter rows that have a file
    const rowsToUpload = draftRows.filter(r => r.file);
    if (rowsToUpload.length === 0) {
      showWarning('Please select at least one video file to upload.', 'No Video Selected');
      return;
    }

    // Validate captions
    for (const row of rowsToUpload) {
      if (!row.caption || !row.caption.trim()) {
        showWarning(`Caption is required for video "${row.file.name}".`, 'Missing Caption');
        return;
      }
    }

    setIsUploading(true);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rowsToUpload.length; i++) {
      const row = rowsToUpload[i];
      setUploadIndex(i + 1);

      try {
        const res = await uploadCompetitionGuidanceVideo(
          competitionId,
          row.file,
          row.caption.trim(),
          Number(row.order || videos.length + i + 1)
        );

        if (res && res.success) {
          successCount++;
        } else {
          failedCount++;
          console.error('Upload failed for row:', row.caption, res?.message);
        }
      } catch (err) {
        failedCount++;
        console.error('Upload error for row:', row.caption, err);
      }
    }

    setIsUploading(false);
    setUploadIndex(-1);

    if (successCount > 0) {
      await showSuccess(
        `${successCount} guidance video${successCount > 1 ? 's' : ''} uploaded and processed into Bunny Stream successfully.`,
        'Videos Uploaded'
      );
      // Reset draft rows
      setDraftRows([{ id: `draft_${Date.now()}`, caption: '', file: null, order: 1, progress: 0 }]);
      // Reload strictly from backend to replace state
      await loadVideos();
    } else {
      showError('Failed to upload guidance videos to Bunny Stream. Please check credentials and try again.');
    }
  };

  // --- Video Management Actions ---
  const handleMoveVideo = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= videos.length) return;

    const reordered = [...videos];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    setVideos(reordered);
    const videoIds = reordered.map(v => v.id);

    setReordering(true);
    try {
      await reorderCompetitionGuidanceVideos(competitionId, videoIds);
    } catch (err) {
      console.error('Failed to save order:', err);
      showError('Failed to save reordered video positions');
      await loadVideos();
    } finally {
      setReordering(false);
    }
  };

  const handleDeleteVideo = async (vid) => {
    const confirmed = await confirm(
      `Are you sure you want to delete "${vid.caption || vid.title}"? This video will also be permanently deleted from Bunny Stream CDN.`,
      'Delete Guidance Video',
      'Yes, Delete Video',
      'Cancel'
    );
    if (!confirmed) return;

    try {
      const res = await deleteCompetitionGuidanceVideo(vid.id);
      if (res && res.success) {
        await showSuccess('Guidance video removed from academy and Bunny Stream.');
        await loadVideos();
      } else {
        showError(res?.message || 'Failed to delete video');
      }
    } catch (err) {
      showError(err.message || 'Failed to delete video');
    }
  };

  const handleSaveCaptionEdit = async (e) => {
    e.preventDefault();
    if (!editingVideo || !editingVideo.caption.trim()) return;

    setSavingCaption(true);
    try {
      const res = await updateCompetitionGuidanceVideo(editingVideo.id, {
        caption: editingVideo.caption.trim(),
        sortOrder: editingVideo.sortOrder
      });
      if (res && res.success) {
        await showSuccess('Caption updated successfully.');
        setEditingVideo(null);
        await loadVideos();
      } else {
        showError(res?.message || 'Failed to update caption');
      }
    } catch (err) {
      showError(err.message || 'Failed to update caption');
    } finally {
      setSavingCaption(false);
    }
  };

  const handleReplaceVideoSubmit = async (e) => {
    e.preventDefault();
    if (!replacingVideo || !replaceFile) {
      showWarning('Please select a replacement video file.', 'No File Selected');
      return;
    }

    setIsReplacing(true);
    try {
      const res = await replaceCompetitionGuidanceVideo(
        replacingVideo.id,
        replaceFile,
        replacingVideo.caption
      );
      if (res && res.success) {
        await showSuccess('Guidance video file replaced on Bunny Stream successfully.', 'Video Replaced');
        setReplacingVideo(null);
        setReplaceFile(null);
        await loadVideos();
      } else {
        showError(res?.message || 'Failed to replace video file');
      }
    } catch (err) {
      showError(err.message || 'Failed to replace video file');
    } finally {
      setIsReplacing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Video className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-black text-slate-900">
              Guidance Videos & Briefings
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Upload mentor explanation videos paired with captions for {competitionTitle ? <span className="font-bold text-indigo-900">{competitionTitle}</span> : 'this competition'}. 
            Videos are automatically transcoded and streamed directly via <span className="font-bold text-indigo-700">Bunny Stream CDN</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 bg-white text-indigo-700 text-xs font-black rounded-xl border border-indigo-200 shadow-2xs">
            {videos.length} Published
          </span>
        </div>
      </div>

      {/* SECTION 1: DYNAMIC PAIR UPLOADER (Caption + Video File pairs) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div>
          <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
            <span>Add Guidance Videos</span>
            <span className="text-[10px] text-slate-400 font-medium">(Caption + Video File Pairs)</span>
          </h4>
          <p className="text-[11px] text-slate-500">
            Enter a descriptive caption and pick an MP4, WebM, or MOV file for the guidance video.
          </p>
        </div>

        {/* Dynamic Rows */}
        <div className="space-y-3">
          {draftRows.map((row, index) => (
            <div 
              key={row.id}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center gap-3 transition hover:border-slate-300"
            >
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center justify-center">
                  {index + 1}
                </span>
                <Film className="w-4 h-4 text-slate-400" />
              </div>

              {/* Caption Input */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Video Caption *
                </label>
                <input
                  type="text"
                  required
                  disabled={isUploading}
                  value={row.caption}
                  onChange={(e) => handleRowChange(row.id, 'caption', e.target.value)}
                  placeholder="e.g. Round 1 Speech Pattern & Rules Walkthrough"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Video File Picker */}
              <div className="flex-1 min-w-[240px]">
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Video File (MP4, WebM, MOV) *
                </label>
                <div className="relative">
                  <input
                    type="file"
                    disabled={isUploading}
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    onChange={(e) => handleRowFileChange(row.id, e)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer border border-dashed border-slate-300 rounded-xl p-1 bg-white"
                  />
                </div>
                {row.fileName && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 truncate">
                    Selected: {row.fileName}
                  </p>
                )}
              </div>

              {/* Optional Order */}
              <div className="w-20 shrink-0">
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Position
                </label>
                <input
                  type="number"
                  disabled={isUploading}
                  min={1}
                  value={row.order}
                  onChange={(e) => handleRowChange(row.id, 'order', e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Remove Row Button */}
              {draftRows.length > 1 && (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleRemoveDraftRow(row.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer self-end md:self-center disabled:opacity-40"
                  title="Remove this video row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Upload Action Bar */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold">
              {draftRows.filter(r => r.file).length} of {draftRows.length} video files ready
            </span>
            {isUploading && (
              <span className="text-indigo-600 font-bold flex items-center gap-1.5">
                <InlineSpinner size="sm" />
                <span>Streaming video {uploadIndex} to Bunny Stream...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={handleAddDraftRow}
              className="px-3.5 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
            >
              + Add Another Video
            </button>
            <button
              type="button"
              disabled={isUploading || draftRows.every(r => !r.file)}
              onClick={handleUploadAllDrafts}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <ButtonSpinner size="sm" />
                  <span>Uploading to Bunny Stream...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload & Save Videos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: PUBLISHED GUIDANCE VIDEOS LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <span>Published Guidance Videos ({videos.length})</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Participants stream these videos in their competition portal in the exact order shown.
            </p>
          </div>
          {videos.length > 1 && (
            <span className="text-[10px] font-semibold text-slate-400">
              Use ↑ and ↓ arrows to reorder
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <InlineSpinner size="md" />
            <span>Loading guidance videos...</span>
          </div>
        ) : videos.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 space-y-2">
            <Video className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600">No guidance videos published yet.</p>
            <p className="text-slate-400 text-[11px]">Use the pair uploader above to add caption and video files.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((vid, idx) => (
              <div
                key={vid.id || vid.bunnyVideoId || idx}
                className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3 flex flex-col justify-between transition hover:border-slate-300"
              >
                {/* Top Bar with Position and Actions */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 shrink-0">
                        #{idx + 1}
                      </span>
                      <h5 className="font-black text-xs text-slate-900 truncate" title={vid.caption || vid.title}>
                        {vid.caption || vid.title}
                      </h5>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0 || reordering}
                        onClick={() => handleMoveVideo(idx, -1)}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === videos.length - 1 || reordering}
                        onClick={() => handleMoveVideo(idx, 1)}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingVideo({ id: vid.id, caption: vid.caption || vid.title, sortOrder: vid.sortOrder || idx + 1 })}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                        title="Edit Caption"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(vid)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        title="Delete Video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    Bunny GUID: {vid.bunnyVideoId}
                  </p>
                </div>

                {/* Footer Bar: Stream Info, Replace Video & Preview */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingVideo({ id: vid.id, caption: vid.caption || vid.title });
                      setReplaceFile(null);
                    }}
                    className="text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1 cursor-pointer"
                    title="Replace with new video file"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Replace File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewVideo(vid)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg flex items-center gap-1 cursor-pointer transition"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview Stream</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: PREVIEW STREAM MODAL */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-4 space-y-3 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Video className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-bold text-xs truncate">
                  {previewVideo.caption || previewVideo.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden aspect-video bg-black">
              <SafeVideo 
                bunnyVideoId={previewVideo.bunnyVideoId} 
                title={previewVideo.caption || previewVideo.title}
                className="w-full h-full" 
                autoPlay 
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Streaming via Bunny Stream CDN</span>
              <span className="font-mono">ID: {previewVideo.bunnyVideoId}</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT CAPTION MODAL */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleSaveCaptionEdit} 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>Edit Video Caption</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Caption *
              </label>
              <textarea
                required
                rows={3}
                value={editingVideo.caption}
                onChange={(e) => setEditingVideo({ ...editingVideo, caption: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Enter descriptive video caption..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingCaption || !editingVideo.caption.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingCaption ? <ButtonSpinner size="sm" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Save Caption</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: REPLACE VIDEO FILE MODAL */}
      {replacingVideo && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleReplaceVideoSubmit} 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-600" />
                <span>Replace Guidance Video File</span>
              </h4>
              <button
                type="button"
                disabled={isReplacing}
                onClick={() => setReplacingVideo(null)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900">
              <span className="font-bold">Target Video: </span>
              <span>{replacingVideo.caption}</span>
              <p className="text-[11px] text-indigo-700 mt-1">
                The new file will be uploaded directly to Bunny Stream, and the old video will be removed from Bunny Stream automatically.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select New Video File (MP4, WebM, MOV) *
              </label>
              <input
                type="file"
                required
                disabled={isReplacing}
                accept="video/mp4,video/webm,video/quicktime,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setReplaceFile(file);
                }}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer border border-dashed border-slate-300 rounded-xl p-2 bg-slate-50"
              />
              {replaceFile && (
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                  Selected: {replaceFile.name} ({(replaceFile.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isReplacing}
                onClick={() => setReplacingVideo(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isReplacing || !replaceFile}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isReplacing ? <ButtonSpinner size="sm" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{isReplacing ? 'Uploading to Bunny...' : 'Replace Video'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
