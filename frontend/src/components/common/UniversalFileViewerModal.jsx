import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Download, FileText, Film, Music, Image as ImageIcon, FileSpreadsheet, Archive, AlertCircle, Loader2 } from 'lucide-react';
import { resolveFileUrl, getFileLink, openFileWithSignedLink } from '../../api/fileApi';
import { useAuth } from '../../context/AuthContext';
import SafeImage from './SafeImage';
import CustomPdfViewer from './CustomPdfViewer';

export default function UniversalFileViewerModal({ isOpen, onClose, file, hideDownload = true }) {
  const auth = useAuth?.() || {};
  const user = auth.user;
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [resolvedInfo, setResolvedInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textLoading, setTextLoading] = useState(false);

  // Lock body scroll while modal is open (Task 3)
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    let active = true;
    if (!isOpen || !file) {
      setResolvedUrl('');
      setResolvedInfo(null);
      setErrorMsg('');
      setTextContent('');
      return;
    }
    setErrorMsg('');
    const raw = file.url || file.fileUrl || file.path || file.id || '';
    if (!raw) {
      setResolvedUrl('#');
      return;
    }
    const match = String(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (match) {
      getFileLink(match[0])
        .then(res => {
          if (!active) return;
          if (res) {
            setResolvedInfo(res);
            setResolvedUrl(res.url || resolveFileUrl(raw));
          } else {
            setResolvedUrl(resolveFileUrl(raw));
          }
        })
        .catch(err => {
          if (!active) return;
          let displayMsg = err?.message || 'Access Denied: This file is locked or you do not have permission.';
          if (err?.code === 'LOCKED_SCHEDULE') {
            displayMsg = err.unlockAt ? `Schedule resources are locked. Unlocks at ${err.unlockAt}` : 'Schedule resources are locked until 60 minutes before session.';
          } else if (err?.code === 'LOCKED_MODULE') {
            displayMsg = err.message || 'Complete previous module to unlock this resource.';
          } else if (err?.code === 'NOT_ENROLLED') {
            displayMsg = 'You are not enrolled in this course.';
          } else if (displayMsg.includes('403') || displayMsg.includes('HTTP 403')) {
            displayMsg = 'Access Denied: You do not have permission to access this file.';
          }
          setErrorMsg(displayMsg);
          setResolvedUrl('');
        });
    } else {
      setResolvedUrl(resolveFileUrl(raw));
    }
    return () => { active = false; };
  }, [isOpen, file]);

  const fileName = resolvedInfo?.name || file?.name || file?.title || file?.filename || 'Attachment File';
  const fileUrl = resolvedInfo?.url || resolvedUrl || resolveFileUrl(file?.url || file?.fileUrl || file?.path) || '#';
  const fileSize = resolvedInfo?.size ? `${Math.round(resolvedInfo.size / 1024)} KB` : (file?.size || file?.fileSize || 'Standard');

  // Extract Extension & MIME
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const mimeType = (resolvedInfo?.contentType || file?.contentType || file?.mimeType || file?.type || '').toLowerCase();

  const isImage = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
  const isVideo = mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
  const isAudio = mimeType.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext);
  const isPdf = mimeType === 'application/pdf' || ext === 'pdf' || fileUrl.includes('.pdf') || (resolvedInfo?.url && resolvedInfo.url.includes('.pdf'));
  const isTxt = ext === 'txt' || mimeType.startsWith('text/plain');
  const isCsv = ext === 'csv' || mimeType === 'text/csv';
  const isSpreadsheet = ['xls', 'xlsx'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel');
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) ||
                   mimeType.includes('officedocument') ||
                   mimeType.includes('msword') ||
                   mimeType.includes('ms-excel') ||
                   mimeType.includes('ms-powerpoint');
  const isArchive = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar');

  // Fetch text/csv contents if applicable
  useEffect(() => {
    if (!isOpen || !fileUrl || fileUrl === '#' || (!isTxt && !isCsv)) {
      setTextContent('');
      return;
    }
    setTextLoading(true);
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = {};
    if (token && (fileUrl.startsWith('/api/') || (typeof window !== 'undefined' && fileUrl.startsWith(window.location.origin)))) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    fetch(fileUrl, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setTextContent(text);
        setTextLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load text document:', err);
        setTextContent('Unable to load document content.');
        setTextLoading(false);
      });
  }, [isOpen, fileUrl, isTxt, isCsv]);

  if (!isOpen || !file) return null;

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'SUPER_ADMIN';
  const isRestrictedRole = ['STUDENT', 'TRAINER', 'CANDIDATE'].includes(user?.role?.toUpperCase());
  const canDownload = !hideDownload && !isRestrictedRole;

  const csvRows = isCsv && textContent ? textContent.trim().split('\n').map(row => row.split(',').map(c => c.trim().replace(/^"|"$/g, ''))) : [];

  const modalContent = (
    <div 
      onContextMenu={hideDownload ? (e) => e.preventDefault() : undefined}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in"
    >
      <div className="bg-white rounded-none sm:rounded-3xl max-w-5xl w-full h-full sm:h-[92vh] sm:w-[94vw] max-h-none sm:max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              {isImage && <ImageIcon className="w-5 h-5" />}
              {isVideo && <Film className="w-5 h-5" />}
              {isAudio && <Music className="w-5 h-5" />}
              {isPdf && <FileText className="w-5 h-5 text-red-600" />}
              {(isSpreadsheet || isCsv) && <FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
              {isTxt && <FileText className="w-5 h-5 text-sky-600" />}
              {isArchive && <Archive className="w-5 h-5 text-purple-600" />}
              {!isImage && !isVideo && !isAudio && !isPdf && !isSpreadsheet && !isCsv && !isTxt && !isArchive && (
                <FileText className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {fileName}
              </h3>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {ext ? `${ext.toUpperCase()} File` : 'Document'} • {fileSize}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-200 rounded-full transition-colors shrink-0 shadow-xs border border-slate-200 cursor-pointer"
            aria-label="Close Viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center bg-slate-100/50 min-h-[300px]">
          {errorMsg ? (
            <div className="max-w-md w-full bg-red-50 border border-red-200 text-red-800 p-8 rounded-3xl text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-base text-red-900">Access Restricted</h4>
              <p className="text-xs text-red-700 font-medium leading-relaxed">{errorMsg}</p>
            </div>
          ) : (
            <>
              {/* 1. IMAGE VIEWER */}
              {isImage && (
                <div 
                  className="max-h-full max-w-full flex items-center justify-center relative select-none"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <SafeImage
                    src={fileUrl}
                    alt={fileName}
                    draggable={false}
                    className="max-h-[70vh] w-auto max-w-full object-contain rounded-2xl shadow-lg border border-slate-200 bg-white select-none pointer-events-auto"
                    fallbackSrc="/assets/course-placeholder.svg"
                  />
                  {!isAdmin && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <span className="transform -rotate-45 text-slate-900/10 font-black text-2xl tracking-widest uppercase select-none">
                        {user?.name || user?.email || 'View Only'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. VIDEO PLAYER */}
              {isVideo && (
                <div 
                  className="w-full max-w-3xl flex flex-col items-center select-none"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <video
                    src={fileUrl}
                    controls
                    controlsList="nodownload"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full max-h-[70vh] rounded-2xl shadow-xl bg-black border border-slate-800"
                  >
                    Your browser does not support HTML5 video playback.
                  </video>
                </div>
              )}

              {/* 3. AUDIO PLAYER */}
              {isAudio && (
                <div 
                  className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 text-center select-none"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className="w-20 h-20 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Music className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">{fileName}</h4>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Audio File • Ready to Play</p>
                  </div>
                  <audio 
                    src={fileUrl} 
                    controls 
                    controlsList="nodownload" 
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full"
                  >
                    Your browser does not support HTML5 audio playback.
                  </audio>
                </div>
              )}

              {/* 4. PDF CUSTOM CANVAS VIEWER (Also renders converted office documents) */}
              {isPdf && (
                <div className="w-full h-full min-h-[75vh] flex-1 rounded-2xl overflow-hidden shadow-lg border border-slate-700">
                  <CustomPdfViewer
                    url={fileUrl}
                    title={fileName}
                    fileType={ext ? ext.toUpperCase() : 'PDF'}
                    watermarkText={!isAdmin ? (user?.name || user?.email || 'Zoro English Academy') : ''}
                    showTitle={false}
                  />
                </div>
              )}

              {/* 5. TXT FILE VIEWER */}
              {isTxt && (
                <div className="w-full h-[70vh] bg-white rounded-2xl p-6 overflow-auto border border-slate-200 font-mono text-xs whitespace-pre-wrap select-text leading-relaxed text-slate-800">
                  {textLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      <span>Loading document...</span>
                    </div>
                  ) : (
                    textContent
                  )}
                </div>
              )}

              {/* 6. CSV TABLE VIEWER */}
              {isCsv && (
                <div className="w-full h-[70vh] bg-white rounded-2xl overflow-auto border border-slate-200 shadow-inner">
                  {textLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      <span>Loading spreadsheet...</span>
                    </div>
                  ) : csvRows.length > 0 ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          {csvRows[0].map((header, hIdx) => (
                            <th key={hIdx} className="p-3 font-extrabold text-slate-800 border-r border-slate-200 last:border-r-0">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvRows.slice(1).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/50">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-2.5 text-slate-700 border-r border-slate-100 last:border-r-0 font-medium">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-slate-400">Empty CSV file</div>
                  )}
                </div>
              )}

              {/* 7. UNCONVERTED OFFICE DOCUMENT FALLBACK */}
              {!isPdf && isOffice && !isCsv && (
                <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-5">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
                    {isSpreadsheet ? <FileSpreadsheet className="w-10 h-10 text-emerald-600" /> : <FileText className="w-10 h-10 text-blue-600" />}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-900 text-base">{fileName}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      {ext ? `${ext.toUpperCase()} File` : 'Office Document'} • {fileSize}
                    </p>
                    <p className="text-xs text-slate-400 pt-2">
                      Document is being prepared for preview.
                    </p>
                  </div>

                  {canDownload && fileUrl && fileUrl !== '#' && (
                    <button
                      type="button"
                      onClick={() => openFileWithSignedLink(fileUrl, fileName)}
                      className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs shadow-md transition-all w-full cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download File</span>
                    </button>
                  )}
                </div>
              )}

              {/* 8. UNKNOWN BINARY FORMAT FRIENDLY CARD */}
              {!isImage && !isVideo && !isAudio && !isPdf && !isTxt && !isCsv && !isOffice && (
                <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-5">
                  <div className="w-20 h-20 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center mx-auto border border-slate-200">
                    {isArchive ? <Archive className="w-10 h-10 text-purple-600" /> : <FileText className="w-10 h-10 text-slate-600" />}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-900 text-base">Preview not available for this file type</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      {ext ? `${ext.toUpperCase()} File` : 'Attachment'} • {fileSize}
                    </p>
                    <p className="text-xs text-slate-400 pt-2">
                      {canDownload ? 'File is ready for download.' : 'Direct in-browser preview is not supported for this file format.'}
                    </p>
                  </div>

                  {canDownload && fileUrl && fileUrl !== '#' && (
                    <button
                      type="button"
                      onClick={() => openFileWithSignedLink(fileUrl, fileName)}
                      className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs shadow-md transition-all w-full cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download File</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-between">
          <div>
            {canDownload && !errorMsg && fileUrl && fileUrl !== '#' && (
              <button
                type="button"
                onClick={() => openFileWithSignedLink(fileUrl, fileName)}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200/60 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}
