import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  ImageIcon,
  Video as VideoIcon,
  ArrowUp,
  ArrowDown,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Save,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  getAllFeedbackMedia,
  uploadFeedbackMedia,
  updateFeedbackMediaOrder,
  deleteFeedbackMedia,
  getFeedbackMediaStatus,
  getFeedbackVideoPlayback
} from '../../api/feedbackMediaApi';
import { resolveFileUrl } from '../../api/fileApi';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import { useDialog } from '../../context/DialogContext';

export default function AdminFeedbackSectionTab({ onUnsavedChange }) {
  const { showSuccess, showError, confirm } = useDialog();

  const [mediaList, setMediaList] = useState([]);
  const [initialOrderIds, setInitialOrderIds] = useState([]);
  const [hasUnsavedOrder, setHasUnsavedOrder] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  // Notify parent component about unsaved order changes
  useEffect(() => {
    if (typeof onUnsavedChange === 'function') {
      onUnsavedChange(hasUnsavedOrder);
    }
  }, [hasUnsavedOrder, onUnsavedChange]);

  const loadMedia = async () => {
    setIsLoading(true);
    try {
      const res = await getAllFeedbackMedia();
      if (res && res.success && Array.isArray(res.data)) {
        setMediaList(res.data);
        setInitialOrderIds(res.data.map((item) => item.id));
        setHasUnsavedOrder(false);
      }
    } catch (err) {
      console.error('Failed to load feedback media:', err);
      await showError(err?.message || 'Failed to load feedback media items.', 'Error Loading Media');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  // Poll status for items that are currently processing
  useEffect(() => {
    const processingItems = mediaList.filter(
      (m) => m.mediaType === 'VIDEO' && m.status === 'PROCESSING'
    );
    if (processingItems.length === 0) return;

    const interval = setInterval(async () => {
      try {
        let updatedAny = false;
        const updatedList = await Promise.all(
          mediaList.map(async (item) => {
            if (item.mediaType === 'VIDEO' && item.status === 'PROCESSING') {
              try {
                const statusRes = await getFeedbackMediaStatus(item.id);
                if (statusRes && statusRes.success && statusRes.data) {
                  if (statusRes.data.status !== item.status) {
                    updatedAny = true;
                    return statusRes.data;
                  }
                }
              } catch {
                // ignore transient polling errors
              }
            }
            return item;
          })
        );
        if (updatedAny) {
          setMediaList(updatedList);
        }
      } catch (err) {
        console.debug('Polling error for processing feedback video:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [mediaList]);

  // Handle client-side audio rejection and file validation
  const processFiles = async (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    const audioExtensions = ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'aac', 'flac', 'wma', 'mid', 'midi', 'aiff'];
    const validImageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const validVideoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv'];

    for (const file of files) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      // Immediate audio rejection
      if (audioExtensions.includes(ext) || file.type.startsWith('audio/')) {
        await showError(
          `"${file.name}" is an audio file. Audio files are not supported in the feedback gallery. Please select images (JPG, PNG, WEBP) or videos (MP4, MOV, AVI, WEBM, MKV).`,
          'Audio File Rejected'
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const isImage = validImageExtensions.includes(ext) || file.type.startsWith('image/');
      const isVideo = validVideoExtensions.includes(ext) || file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        await showError(
          `"${file.name}" has an unsupported format. Please upload only images (JPG, PNG, WEBP) or videos (MP4, MOV, AVI, WEBM, MKV).`,
          'Unsupported Format'
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (isImage && file.size > 5 * 1024 * 1024) {
        await showError(
          `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Image files must not exceed 5 MB.`,
          'Image Size Limit Exceeded'
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (isVideo && file.size > 500 * 1024 * 1024) {
        await showError(
          `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Video files must not exceed 500 MB.`,
          'Video Size Limit Exceeded'
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(`Uploading ${files.length} media item(s)...`);

    try {
      const res = await uploadFeedbackMedia(files, (percent) => {
        setUploadProgress(`Uploading... ${percent}%`);
      });

      if (res && res.success) {
        await loadMedia();
        await showSuccess(
          `Successfully uploaded ${files.length} feedback media item(s).`,
          'Upload Complete'
        );
      } else {
        await showError(res?.message || 'Failed to upload media files.', 'Upload Failed');
      }
    } catch (err) {
      console.error('Feedback media upload failed:', err);
      await showError(err.message || 'Failed to upload media files.', 'Upload Error');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e) => {
    processFiles(e.target.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleMove = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mediaList.length) return;

    const newList = [...mediaList];
    const [moved] = newList.splice(index, 1);
    newList.splice(targetIndex, 0, moved);

    const reordered = newList.map((item, idx) => ({ ...item, sortOrder: idx }));
    setMediaList(reordered);

    // Check if order is different from initial
    const currentOrder = reordered.map((item) => item.id);
    const changed = JSON.stringify(currentOrder) !== JSON.stringify(initialOrderIds);
    setHasUnsavedOrder(changed);
  };

  const handleSaveOrder = async () => {
    if (!hasUnsavedOrder) return;
    setIsSavingOrder(true);
    try {
      const orderedIds = mediaList.map((m) => m.id);
      const res = await updateFeedbackMediaOrder(orderedIds);
      if (res && res.success) {
        setInitialOrderIds(orderedIds);
        setHasUnsavedOrder(false);
        await showSuccess('Feedback gallery order saved successfully.', 'Order Saved');
      } else {
        await showError(res?.message || 'Failed to save gallery order.', 'Save Failed');
        await loadMedia();
      }
    } catch (err) {
      console.error('Failed to update feedback order:', err);
      await showError(err.message || 'Failed to save order changes.', 'Error');
      await loadMedia();
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handlePreview = async (item) => {
    const isVideo = item.mediaType === 'VIDEO';
    if (isVideo) {
      if (item.status !== 'READY') {
        await showError(
          'This video is still being processed by Bunny Stream or failed. Preview is available once processing is complete.',
          'Video Not Ready'
        );
        return;
      }
      setLoadingPreviewId(item.id);
      try {
        const res = await getFeedbackVideoPlayback(item.id);
        if (res && res.success && res.data) {
          setPreviewItem({
            name: item.originalFileName || 'Feedback Video',
            contentType: 'video/mp4',
            mediaType: 'VIDEO',
            embedUrl: res.data.embedUrl,
            fileUrl: res.data.streamUrl,
            url: res.data.embedUrl,
            id: item.id,
            bunnyVideoId: item.bunnyVideoId
          });
        } else {
          await showError(res?.message || 'Failed to load video preview.', 'Preview Failed');
        }
      } catch (err) {
        console.error('Failed to load video playback for preview:', err);
        await showError(err?.message || 'Failed to authorize video playback.', 'Preview Error');
      } finally {
        setLoadingPreviewId(null);
      }
    } else {
      setPreviewItem({
        name: item.originalFileName || 'Feedback Image',
        url: item.url,
        fileUrl: item.url,
        contentType: item.contentType || 'image/jpeg',
        mediaType: 'IMAGE',
        id: item.storedFileId || item.id
      });
    }
  };

  const handleDelete = async (item) => {
    const isConfirmed = await confirm({
      title: 'Delete Feedback Media',
      message: `Are you sure you want to delete "${item.originalFileName || 'this media item'}"? This removes the record from the gallery and permanently purges the file from storage.`,
      confirmText: 'Delete Media',
      danger: true
    });
    if (!isConfirmed) return;

    try {
      const res = await deleteFeedbackMedia(item.id);
      if (res && res.success) {
        const remaining = mediaList.filter((m) => m.id !== item.id);
        const reordered = remaining.map((m, idx) => ({ ...m, sortOrder: idx }));
        setMediaList(reordered);
        setInitialOrderIds(reordered.map((m) => m.id));
        setHasUnsavedOrder(false);
        await showSuccess('Media item deleted and purged successfully.', 'Item Deleted');
      } else {
        await showError(res?.message || 'Failed to delete media item.', 'Delete Failed');
      }
    } catch (err) {
      console.error('Delete feedback media error:', err);
      await showError(err.message || 'Failed to delete media item.', 'Delete Error');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Upload Box & Guidance Panel Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Upload Area */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#0F52BA]" />
                <span>Feedback Gallery Media Management</span>
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                Upload student & parent feedback photos and video testimonials for the public landing page gallery.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs">
                {mediaList.length} items
              </span>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-[#0F52BA] bg-blue-50/50'
                : 'border-slate-300 hover:border-[#0F52BA] hover:bg-slate-50/80'
            } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska"
              onChange={handleFileInputChange}
              disabled={isUploading}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0F52BA] flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-[#0F52BA]" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-extrabold text-slate-800">
                {isUploading ? uploadProgress || 'Uploading media files...' : 'Click or drag photos and videos here'}
              </p>
              <p className="text-[11px] text-slate-500">
                Supports multiple files together (JPG, PNG, WEBP, MP4, MOV, WEBM). Audio files are rejected.
              </p>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={loadMedia}
              disabled={isLoading || isUploading}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh List</span>
            </button>

            <button
              type="button"
              onClick={handleSaveOrder}
              disabled={!hasUnsavedOrder || isSavingOrder}
              className={`px-4 py-2 rounded-xl font-extrabold text-xs inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                hasUnsavedOrder
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 animate-pulse'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSavingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{hasUnsavedOrder ? 'Save Order Changes' : 'Order Saved'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Guidance Panel (Task H3.5) */}
        <div className="lg:col-span-5 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 text-slate-600">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>Media Specifications & Guidance</span>
          </h4>

          <div className="space-y-3 text-xs leading-relaxed text-slate-600">
            {/* Hero guidance */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
              <span className="font-extrabold text-slate-800 block text-[11px] text-blue-700">
                1. Hero Background Images
              </span>
              <p className="text-[11px]">
                <strong>Recommended Dimensions:</strong> 1920 × 1080 px (16:9 aspect ratio)
              </p>
              <p className="text-[11px] text-slate-500">
                <strong>Container Behavior:</strong> Content-driven height (~540–600px desktop with <code>md:py-24</code>, ~580–620px mobile with <code>py-16</code>, min 500px).
              </p>
              <p className="text-[11px] text-slate-500">
                <strong>Crop Note:</strong> Sized via <code>object-cover object-center</code>. Wide desktop viewports crop ~25% top and bottom margins; mobile viewports crop ~30% left and right margins. Keep critical subjects in the center safe zone.
              </p>
            </div>

            {/* Feedback Gallery Image guidance */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
              <span className="font-extrabold text-slate-800 block text-[11px] text-purple-700">
                2. Feedback Gallery Images
              </span>
              <p className="text-[11px]">
                <strong>Recommended Dimensions:</strong> 1920 × 1080 px (16:9 aspect ratio)
              </p>
              <p className="text-[11px] text-slate-500">
                <strong>Frame:</strong> Shown in a fixed 16:9 frame using <code>object-contain</code> on a soft blurred background, ensuring feedback screenshots, parent WhatsApp quotes, and photos are never cut off.
              </p>
              <p className="text-[11px] text-slate-500">
                <strong>Formats & Limit:</strong> JPG, JPEG, PNG, WEBP (Maximum 5 MB).
              </p>
            </div>

            {/* Feedback Gallery Video guidance */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
              <span className="font-extrabold text-slate-800 block text-[11px] text-emerald-700">
                3. Feedback Gallery Videos
              </span>
              <p className="text-[11px]">
                <strong>Preferred Resolution:</strong> 1920 × 1080 px (16:9 Full HD)
              </p>
              <p className="text-[11px] text-slate-500">
                <strong>Supported Formats:</strong> MP4, MOV, AVI, WEBM, MKV (Maximum 500 MB).
              </p>
              <p className="text-[11px] text-slate-500">
                <strong>Streaming:</strong> Video is uploaded directly to Bunny Stream, encoded into adaptive multi-resolution HLS streams, and secured with token authorization.
              </p>
            </div>

            {/* Audio strictly rejected */}
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Audio files (MP3, WAV, etc.) are strictly rejected by the server and user interface.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Media Items List Section */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">Configured Feedback Gallery Items</h4>
            <p className="text-slate-500 text-xs mt-0.5">
              Items are displayed in the public Feedback section in the exact order below. Use Up/Down to rearrange and click "Save Order Changes".
            </p>
          </div>

          {hasUnsavedOrder && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Unsaved Order Changes</span>
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#0F52BA]" />
            <span className="text-xs font-semibold">Loading feedback gallery items...</span>
          </div>
        ) : mediaList.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
            <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-extrabold text-slate-700 text-xs">No feedback media uploaded yet</p>
            <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
              When no items are published, the public Feedback section remains completely hidden from visitors.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {mediaList.map((item, index) => {
              const isVideo = item.mediaType === 'VIDEO';
              const isReady = item.status === 'READY';
              const isProcessing = item.status === 'PROCESSING';

              return (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 rounded-xl px-2 transition-colors"
                >
                  {/* Left: Reorder buttons & Thumbnail */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Up / Down Buttons */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        title="Move Up"
                        aria-label={`Move ${item.originalFileName || 'item'} up`}
                        className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-25 disabled:pointer-events-none text-slate-700 cursor-pointer transition-colors"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === mediaList.length - 1}
                        title="Move Down"
                        aria-label={`Move ${item.originalFileName || 'item'} down`}
                        className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-25 disabled:pointer-events-none text-slate-700 cursor-pointer transition-colors"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Thumbnail Box */}
                    <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shrink-0 flex items-center justify-center">
                      {isVideo ? (
                        item.thumbnailUrl ? (
                          <img
                            src={resolveFileUrl(item.thumbnailUrl)}
                            alt={item.originalFileName || 'Video thumbnail'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <VideoIcon className="w-6 h-6 text-purple-300" />
                        )
                      ) : (
                        <img
                          src={resolveFileUrl(item.url)}
                          alt={item.originalFileName || 'Feedback photo'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/assets/course-placeholder.svg';
                          }}
                        />
                      )}

                      <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Metadata & Labels */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isVideo
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isVideo ? <VideoIcon className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                          <span>{isVideo ? 'Video' : 'Image'}</span>
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isReady
                              ? 'bg-emerald-100 text-emerald-700'
                              : isProcessing
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{isReady ? 'Ready' : isProcessing ? 'Processing' : 'Failed'}</span>
                        </span>

                        <span className="text-[11px] text-slate-400">
                          {formatFileSize(item.sizeBytes)}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-800 truncate" title={item.originalFileName}>
                        {item.originalFileName || 'Feedback media file'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Preview Large in Shared Modal */}
                    <button
                      type="button"
                      onClick={() => handlePreview(item)}
                      disabled={loadingPreviewId === item.id}
                      title="Preview Large"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {loadingPreviewId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden md:inline">Preview</span>
                    </button>

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      title="Delete Item"
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Universal File Viewer Modal for Preview */}
      <UniversalFileViewerModal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        file={previewItem}
        hideDownload={true}
      />
    </div>
  );
}
