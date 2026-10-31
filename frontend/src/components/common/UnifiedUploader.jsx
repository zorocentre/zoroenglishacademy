import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  File,
  Film,
  Music,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Play,
  Eye,
  Loader2
} from 'lucide-react';
import { unifiedUpload, resolveFileUrl, getFileLink } from '../../api/fileApi';
import SafeVideo from './SafeVideo';
import AudioPromptPlayer from './AudioPromptPlayer';

/**
 * Unified drag-and-drop file uploader supporting Bunny Stream (videos) and Bunny Storage (audio/docs/images).
 *
 * @param {Object} props
 * @param {string} [props.accept='*'] - File input accept filter (e.g. 'video/*', 'audio/*', 'image/*')
 * @param {boolean} [props.multiple=false] - Allow multi-file selection & upload
 * @param {string} [props.category='auto'] - Storage category ('video', 'audio', 'document', 'hero', etc.)
 * @param {number} [props.maxSizeMB=500] - Maximum file size in MB
 * @param {string} [props.title=''] - Optional title or prefix for uploaded files
 * @param {function} [props.onUploadComplete] - Single file callback: (result) => void
 * @param {function} [props.onMultiUploadComplete] - Multi-file callback: (resultsArray) => void
 * @param {string} [props.label=''] - Custom label text
 * @param {string} [props.helperText=''] - Explanatory text below the dropzone
 * @param {string} [props.className=''] - Container className
 * @param {Object} [props.initialValue=null] - Pre-existing uploaded media metadata for display
 * @param {function} [props.onClear] - Clear/reset callback
 */
export default function UnifiedUploader({
  accept = '*',
  multiple = false,
  category = 'auto',
  maxSizeMB = 500,
  title = '',
  onUploadComplete,
  onMultiUploadComplete,
  onUploadingChange,
  label = '',
  helperText = '',
  className = '',
  initialValue = null,
  onClear = null
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadItems, setUploadItems] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [signedInitialUrl, setSignedInitialUrl] = useState('');
  const [signedUrlLoading, setSignedUrlLoading] = useState(false);
  const [signedUrlError, setSignedUrlError] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch signed token link for pre-existing uploaded files
  useEffect(() => {
    let active = true;
    const resolveSignedUrl = async () => {
      if (!initialValue) {
        setSignedInitialUrl('');
        return;
      }
      const raw = initialValue.url || initialValue.id || '';
      if (!raw) return;

      if (raw.startsWith('http') && raw.includes('token=')) {
        setSignedInitialUrl(raw);
        return;
      }

      const uuidMatch = String(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const targetId = uuidMatch ? uuidMatch[0] : (initialValue.id && !String(initialValue.id).startsWith('http') ? initialValue.id : null);
      if (targetId && !initialValue.bunnyVideoId) {
        setSignedUrlLoading(true);
        setSignedUrlError(false);
        try {
          const link = await getFileLink(targetId);
          if (active && link?.url) {
            setSignedInitialUrl(link.url);
            setSignedUrlLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[UnifiedUploader] Failed to fetch signed link for initialValue:', err);
          if (active) setSignedUrlError(true);
        } finally {
          if (active) setSignedUrlLoading(false);
        }
      }
      if (active) {
        setSignedInitialUrl(initialValue.url ? resolveFileUrl(initialValue.url) : resolveFileUrl(raw));
      }
    };

    resolveSignedUrl();
    return () => { active = false; };
  }, [initialValue?.id, initialValue?.url]);

  useEffect(() => {
    const isUploading = uploadItems.some((item) => item.status === 'uploading');
    if (typeof onUploadingChange === 'function') {
      onUploadingChange(isUploading);
    }
  }, [uploadItems, onUploadingChange]);

  const getIconForType = (type, name = '') => {
    const lowerType = (type || '').toLowerCase();
    const lowerName = (name || '').toLowerCase();
    if (lowerType.startsWith('video/') || lowerName.match(/\.(mp4|mov|avi|webm|mkv)$/)) {
      return <Film className="w-5 h-5 text-indigo-500" />;
    }
    if (lowerType.startsWith('audio/') || lowerName.match(/\.(mp3|wav|ogg|m4a|aac)$/)) {
      return <Music className="w-5 h-5 text-purple-500" />;
    }
    if (lowerType.startsWith('image/') || lowerName.match(/\.(jpg|jpeg|png|webp|gif|svg)$/)) {
      return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const startUpload = async (fileObj) => {
    const abortController = new AbortController();
    const itemId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newItem = {
      id: itemId,
      file: fileObj,
      name: fileObj.name,
      size: fileObj.size,
      type: fileObj.type,
      progress: 0,
      status: 'uploading', // 'uploading' | 'completed' | 'error' | 'cancelled'
      error: '',
      result: null,
      abortController
    };

    setUploadItems((prev) => (multiple ? [...prev, newItem] : [newItem]));

    try {
      const res = await unifiedUpload(fileObj, {
        category,
        title: title || fileObj.name.replace(/\.[^/.]+$/, ''),
        signal: abortController.signal,
        onProgress: (percent) => {
          setUploadItems((prev) =>
            prev.map((item) => (item.id === itemId ? { ...item, progress: percent } : item))
          );
        }
      });

      // Immediately resolve signed token URL for uploaded file so previews render real media with auth
      let signedUrl = null;
      if (res && res.id && !res.bunnyVideoId) {
        try {
          const link = await getFileLink(res.id);
          if (link?.url) signedUrl = link.url;
        } catch {
          // ignore
        }
      }
      if (!signedUrl && fileObj && fileObj.type && fileObj.type.startsWith('image/')) {
        try {
          signedUrl = URL.createObjectURL(fileObj);
        } catch {
          // ignore
        }
      }

      const enhancedResult = {
        ...res,
        signedUrl: signedUrl || res.url
      };

      setUploadItems((prev) => {
        const updated = prev.map((item) =>
          item.id === itemId
            ? { ...item, progress: 100, status: 'completed', result: enhancedResult }
            : item
        );
        if (multiple && onMultiUploadComplete) {
          const completedResults = updated
            .filter((it) => it.status === 'completed' && it.result)
            .map((it) => it.result);
          onMultiUploadComplete(completedResults);
        }
        return updated;
      });

      if (!multiple && onUploadComplete) {
        onUploadComplete(enhancedResult);
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        setUploadItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: 'cancelled', error: 'Upload cancelled' } : item
          )
        );
      } else {
        setUploadItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, status: 'error', error: err.message || 'Upload failed' }
              : item
          )
        );
      }
    }
  };

  const handleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const validFiles = files.filter((f) => {
      const sizeMB = f.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        alert(`File "${f.name}" exceeds the maximum allowed size of ${maxSizeMB} MB.`);
        return false;
      }
      return true;
    });

    if (multiple) {
      validFiles.forEach((file) => startUpload(file));
    } else if (validFiles.length > 0) {
      startUpload(validFiles[0]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleCancel = (itemId) => {
    setUploadItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId && item.abortController) {
          item.abortController.abort();
          return { ...item, status: 'cancelled', error: 'Upload cancelled' };
        }
        return item;
      })
    );
  };

  const handleRetry = (item) => {
    if (item.file) {
      // Remove failed item and re-upload
      setUploadItems((prev) => prev.filter((i) => i.id !== item.id));
      startUpload(item.file);
    }
  };

  const handleRemove = (itemId) => {
    setUploadItems((prev) => {
      const filtered = prev.filter((i) => i.id !== itemId);
      if (multiple && onMultiUploadComplete) {
        onMultiUploadComplete(
          filtered.filter((it) => it.status === 'completed' && it.result).map((it) => it.result)
        );
      }
      return filtered;
    });
    if (!multiple) {
      if (onClear) onClear();
    }
  };

  // Format file size helper
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && <label className="block text-xs font-bold text-slate-700">{label}</label>}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]'
            : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-white'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              <span className="text-indigo-600 hover:underline">Click to browse</span> or drag and drop files here
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {helperText || `Supports ${accept.replace(/\/\*/g, 's').toUpperCase()} up to ${maxSizeMB} MB`}
            </p>
          </div>
        </div>
      </div>

      {/* Upload Items Progress & Status List */}
      {uploadItems.length > 0 && (
        <div className="space-y-2">
          {uploadItems.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {getIconForType(item.type, item.name)}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate text-[11px]">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {formatBytes(item.size)} •{' '}
                      {item.status === 'uploading' && `${item.progress}%`}
                      {item.status === 'completed' && (
                        <span className="text-emerald-600 font-bold">
                          {item.result?.storageType === 'BUNNY_STREAM' ? 'Bunny Stream Ready' : 'Uploaded'}
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-rose-600 font-bold">{item.error}</span>
                      )}
                      {item.status === 'cancelled' && (
                        <span className="text-slate-500 font-bold">Cancelled</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.status === 'uploading' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(item.id)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  {item.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => handleRetry(item)}
                      className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                      title="Retry"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {item.status === 'completed' && item.result && (
                    <>
                      {item.result.storageType === 'BUNNY_STREAM' || item.result.bunnyVideoId ? (
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item.result)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-indigo-700" />
                          <span>Preview</span>
                        </button>
                      ) : null}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {item.status === 'uploading' && (
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {/* Inline Audio Player for Audio Uploads */}
              {item.status === 'completed' &&
                (item.result?.url || item.result?.id) &&
                (item.result?.contentType?.startsWith('audio/') ||
                  item.type?.startsWith('audio/') ||
                  item.name?.match(/\.(mp3|wav|ogg|m4a|opus|aac)$/i)) && (
                  <div className="pt-1">
                    <AudioPromptPlayer
                      fileId={item.result?.id}
                      src={item.result?.url || item.result?.id}
                      title={item.name}
                    />
                  </div>
                )}

              {/* Inline Image Preview for newly uploaded images */}
              {item.status === 'completed' &&
                (item.result?.contentType?.startsWith('image/') ||
                  item.type?.startsWith('image/') ||
                  item.name?.match(/\.(png|jpe?g|webp|gif|svg)$/i)) && (
                  <div className="pt-1.5">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 max-w-xs overflow-hidden">
                      <img
                        src={item.result?.signedUrl || (item.file ? URL.createObjectURL(item.file) : (item.result?.url ? resolveFileUrl(item.result.url) : ''))}
                        alt={item.name || 'Uploaded Image Preview'}
                        className="max-h-48 w-full object-contain mx-auto rounded-lg"
                        onError={(e) => {
                          if (item.result?.id) {
                            getFileLink(item.result.id).then(l => {
                              if (l?.url) e.currentTarget.src = l.url;
                            }).catch(() => {});
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Pre-existing initial value display if provided and no active upload items */}
      {uploadItems.length === 0 && initialValue && (() => {
        const isInitialImage = Boolean(
          initialValue.isImage ||
          initialValue.mediaType === 'image' ||
          initialValue.contentType?.startsWith('image/') ||
          (initialValue.name && initialValue.name.match(/\.(png|jpe?g|webp|gif|svg)$/i))
        );

        const isInitialVideo = Boolean(
          initialValue.isVideo ||
          initialValue.mediaType === 'video' ||
          initialValue.bunnyVideoId ||
          initialValue.contentType?.startsWith('video/') ||
          (initialValue.name && initialValue.name.match(/\.(mp4|webm|mov|mkv)$/i))
        );

        const isInitialAudio = Boolean(
          !isInitialImage && !isInitialVideo && (
            initialValue.isAudio ||
            initialValue.mediaType === 'audio' ||
            initialValue.contentType?.startsWith('audio/') ||
            (initialValue.name && initialValue.name.match(/\.(mp3|wav|ogg|m4a|opus|aac)$/i))
          )
        );

        return (
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {getIconForType(
                  initialValue.contentType || (isInitialImage ? 'image/jpeg' : isInitialAudio ? 'audio/mpeg' : isInitialVideo ? 'video/mp4' : ''),
                  initialValue.name || initialValue.title
                )}
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate text-[11px]">
                    {initialValue.name || initialValue.title || 'Uploaded Media'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {initialValue.bunnyVideoId
                      ? `Bunny Stream: ${initialValue.bunnyVideoId}`
                      : initialValue.id
                      ? `Storage ID: ${initialValue.id}`
                      : 'Attached'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(isInitialVideo || initialValue.embedUrl) && (
                  <button
                    type="button"
                    onClick={() => setPreviewItem(initialValue)}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-indigo-700" />
                    <span>Preview</span>
                  </button>
                )}
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Inline Image Preview */}
            {isInitialImage && (
              <div className="pt-1.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 max-w-xs overflow-hidden relative">
                  {signedUrlLoading ? (
                    <div className="h-32 flex items-center justify-center text-slate-400 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin mr-1.5" />
                      <span>Loading image preview...</span>
                    </div>
                  ) : signedUrlError ? (
                    <div className="h-32 flex flex-col items-center justify-center text-rose-500 text-xs p-2 text-center space-y-1">
                      <AlertCircle className="w-5 h-5" />
                      <span>Failed to load image preview</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (initialValue?.id) {
                            setSignedUrlLoading(true);
                            getFileLink(initialValue.id).then(link => {
                              if (link?.url) {
                                setSignedInitialUrl(link.url);
                                setSignedUrlError(false);
                              }
                            }).catch(() => setSignedUrlError(true)).finally(() => setSignedUrlLoading(false));
                          }
                        }}
                        className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <img
                      src={signedInitialUrl || initialValue.signedUrl || (initialValue.url && initialValue.url.includes('token=') ? initialValue.url : null) || resolveFileUrl(initialValue.id)}
                      alt={initialValue.name || 'Question Image Preview'}
                      className="max-h-48 w-full object-contain mx-auto rounded-lg"
                      onError={() => {
                        if (initialValue?.id) {
                          getFileLink(initialValue.id).then(link => {
                            if (link?.url) {
                              setSignedInitialUrl(link.url);
                              setSignedUrlError(false);
                            } else {
                              setSignedUrlError(true);
                            }
                          }).catch(() => setSignedUrlError(true));
                        } else {
                          setSignedUrlError(true);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Inline Video Preview */}
            {isInitialVideo && (
              <div className="pt-1.5 max-w-sm">
                <SafeVideo
                  bunnyVideoId={initialValue.bunnyVideoId || (initialValue.id && !initialValue.id.includes('-') ? initialValue.id : null)}
                  embedUrl={initialValue.embedUrl}
                  src={signedInitialUrl || initialValue.url}
                  className="w-full aspect-video rounded-xl"
                />
              </div>
            )}

            {/* Inline Audio Player for Pre-existing Audio Media */}
            {isInitialAudio && (
              <div className="pt-1">
                <AudioPromptPlayer
                  fileId={initialValue.id}
                  src={signedInitialUrl || initialValue.url || initialValue.id}
                  title={initialValue.name || initialValue.title || 'Audio Prompt'}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Video Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
              <span className="font-bold text-xs truncate">
                {previewItem.title || previewItem.name || 'Video Preview'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SafeVideo
              bunnyVideoId={previewItem.bunnyVideoId || previewItem.videoId || previewItem.id}
              embedUrl={previewItem.embedUrl}
              src={previewItem.url}
              className="w-full aspect-video rounded-xl"
              autoPlay
            />
          </div>
        </div>
      )}
    </div>
  );
}
