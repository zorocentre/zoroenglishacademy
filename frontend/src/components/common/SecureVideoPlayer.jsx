import React, { useRef, useState, useEffect } from 'react';
import { RefreshCw, Lock, VideoOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveFileUrl } from '../../api/fileApi';
import { sendVideoHeartbeat } from '../../api/progressApi';
import usePolling from '../../hooks/usePolling';

export default function SecureVideoPlayer({
  videoRefData,
  videoTitle,
  courseTitle,
  poster,
  studentName = 'Student',
  studentEmail = '',
  isAuthorized = true,
  authErrorMsg = '',
  initialPosition = 0,
  moduleId,
  courseId,
  onProgressUpdate,
  onTokenExpired
}) {
  const { user } = useAuth();
  // Watermark requirement: authenticated user's real email as stored (no name, no course, no forced uppercase)
  const authenticatedEmail = user?.email || studentEmail || '';

  // 1. Parse video reference data and resolve embed URL FIRST to prevent TDZ ReferenceErrors
  let parsedRef = videoRefData;
  if (typeof videoRefData === 'string' && videoRefData.trim().startsWith('{')) {
    try {
      parsedRef = JSON.parse(videoRefData);
    } catch {
      // fallback
    }
  }

  // Resolve embed URL for Bunny Stream iframe player
  let embedUrl = null;
  if (typeof parsedRef === 'string') {
    if (parsedRef.includes('/embed/')) {
      embedUrl = parsedRef;
    }
  } else if (parsedRef && typeof parsedRef === 'object') {
    embedUrl = parsedRef.embedUrl || null;
    if (!embedUrl && parsedRef.videoId && parsedRef.token) {
      const libId = parsedRef.libraryId || '';
      const expParam = parsedRef.expiresAt ? `&expires=${parsedRef.expiresAt}` : '';
      embedUrl = `https://iframe.mediadelivery.net/embed/${libId}/${parsedRef.videoId}?token=${parsedRef.token}${expParam}`;
    }
  }

  const isProcessing = Boolean(
    parsedRef?.status === 'Processing' ||
    parsedRef?.statusLabel === 'Processing' ||
    (typeof authErrorMsg === 'string' && authErrorMsg.toLowerCase().includes('processing'))
  );

  // Resolve thumbnail/poster fallback
  const resolvedPoster = poster
    ? resolveFileUrl(poster)
    : (parsedRef?.thumbnailUrl
        ? resolveFileUrl(parsedRef.thumbnailUrl)
        : (parsedRef?.videoId && parsedRef?.cdnHost
            ? `https://${parsedRef.cdnHost}/${parsedRef.videoId}/thumbnail.jpg`
            : null));

  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const isResumedRef = useRef(false);
  const positionRef = useRef(initialPosition || 0);
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const loadTimeoutRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [_currentTime, setCurrentTime] = useState(initialPosition || 0);
  const [duration, setDuration] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  // Helper to post messages via Player.js protocol
  const postToPlayer = (method, value) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            context: 'player.js',
            method: method,
            value: value
          }),
          '*'
        );
      }
    } catch {
      // ignore cross-origin postMessage errors
    }
  };

  // 30-second stream loading timeout failsafe (Task 10 & TDZ hardened)
  useEffect(() => {
    setLoadError(false);
    if (!embedUrl) return;

    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    if (isPlayerReady || isPlaying) return;

    loadTimeoutRef.current = setTimeout(() => {
      if (!isPlayerReady && !isPlayingRef.current) {
        console.warn('[SecureVideoPlayer] Stream loading timed out after 30s for embedUrl:', embedUrl);
        setLoadError(true);
      }
    }, 30000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [embedUrl, isPlayerReady, isPlaying, replayKey]);

  // Moving Watermark Position State (shifts position periodically)
  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '15%' });

  // Watermark position shifting every 6 seconds using visibility-aware usePolling
  usePolling(() => {
    const topPositions = ['12%', '28%', '65%', '78%', '42%'];
    const leftPositions = ['10%', '55%', '15%', '65%', '40%'];
    const randIdx = Math.floor(Math.random() * topPositions.length);
    setWatermarkPos({
      top: topPositions[randIdx],
      left: leftPositions[randIdx]
    });
  }, 6000, true);

  // Register Player.js event listeners on message
  useEffect(() => {
    isResumedRef.current = false;
    setIsPlayerReady(false);

    const handleMessage = (event) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || data.context !== 'player.js') return;

      // When player reports ready or play, cancel loading timeout
      if (data.event === 'ready' || data.event === 'play' || data.event === 'timeupdate') {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
      }

      if (data.event === 'ready') {
        setIsPlayerReady(true);
        postToPlayer('addEventListener', 'play');
        postToPlayer('addEventListener', 'pause');
        postToPlayer('addEventListener', 'timeupdate');
        postToPlayer('addEventListener', 'ended');

        if (initialPosition > 0 && !isResumedRef.current) {
          postToPlayer('setCurrentTime', initialPosition);
          isResumedRef.current = true;
        }
      } else if (data.event === 'play') {
        setIsPlaying(true);
        isPlayingRef.current = true;
        setIsPlayerReady(true);
      } else if (data.event === 'pause') {
        setIsPlaying(false);
        isPlayingRef.current = false;
      } else if (data.event === 'timeupdate') {
        const val = data.value || {};
        const pos = val.seconds != null ? val.seconds : val.currentTime;
        const dur = val.duration;
        if (pos != null) {
          setCurrentTime(pos);
          positionRef.current = pos;
        }
        if (dur != null && dur > 0) {
          setDuration(dur);
          durationRef.current = dur;
        }
      } else if (data.event === 'ended') {
        setIsPlaying(false);
        isPlayingRef.current = false;

        const effectiveModuleId = moduleId || parsedRef?.moduleId;
        const effectiveCourseId = courseId || parsedRef?.courseId;
        const finalDur = durationRef.current || duration || 0;
        if (effectiveModuleId && finalDur > 0) {
          sendVideoHeartbeat({
            moduleId: effectiveModuleId,
            position: finalDur,
            duration: finalDur,
            courseId: effectiveCourseId,
            studentId: user?.id || user?.email
          }).then(res => {
            if (res?.success && res?.data) {
              onProgressUpdate?.(res.data);
            }
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [embedUrl, initialPosition, moduleId, courseId, user, onProgressUpdate, replayKey]);

  // Heartbeat every 5 seconds while playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (!isPlayingRef.current) return;
      const pos = positionRef.current || 0;
      const dur = durationRef.current || duration || 0;
      const effectiveModuleId = moduleId || parsedRef?.moduleId;
      const effectiveCourseId = courseId || parsedRef?.courseId;

      if (effectiveModuleId && dur > 0) {
        sendVideoHeartbeat({
          moduleId: effectiveModuleId,
          position: pos,
          duration: dur,
          courseId: effectiveCourseId,
          studentId: user?.id || user?.email
        }).then(res => {
          if (res?.success && res?.data) {
            onProgressUpdate?.(res.data);
          }
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, moduleId, courseId, duration, user, onProgressUpdate, parsedRef]);

  // Token expiration refresher (requests new embed token before expiry without interrupting playback)
  useEffect(() => {
    const expiresAt = parsedRef?.expiresAt;
    if (!expiresAt) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSec = expiresAt - nowSec;
    // Request fresh token 2 minutes before expiration
    const refreshTimeoutMs = Math.max((remainingSec - 120) * 1000, 10000);
    const timer = setTimeout(() => {
      onTokenExpired?.();
    }, refreshTimeoutMs);
    return () => clearTimeout(timer);
  }, [parsedRef?.expiresAt, onTokenExpired]);

  const handleIframeLoad = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    // Send Player.js handshake
    postToPlayer('addEventListener', 'ready');
    postToPlayer('addEventListener', 'play');
    postToPlayer('addEventListener', 'pause');
    postToPlayer('addEventListener', 'timeupdate');
    postToPlayer('addEventListener', 'ended');

    if (initialPosition > 0 && !isResumedRef.current) {
      setTimeout(() => {
        postToPlayer('setCurrentTime', initialPosition);
        isResumedRef.current = true;
      }, 600);
    }
  };

  const handleRetry = () => {
    setLoadError(false);
    setIsPlayerReady(false);
    setReplayKey(prev => prev + 1);
    onTokenExpired?.();
  };

  if (!isAuthorized) {
    return (
      <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden flex flex-col items-center justify-center p-8 text-center text-white border border-slate-800 shadow-2xl">
        <div className="w-16 h-16 bg-rose-600/20 border border-rose-500/40 rounded-full flex items-center justify-center mb-4 text-rose-400">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black tracking-tight mb-2">Access Denied: Enrolled Students Only</h3>
        <p className="text-xs text-slate-300 max-w-md mb-4 leading-relaxed">
          {authErrorMsg || 'You are not registered or enrolled in this course. Please sign in to your student account and enroll to stream recorded lessons.'}
        </p>
        <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-3 py-1 rounded-full border border-rose-800">
          🔒 PROTECTED CLOUD STREAMING ACCESS
        </span>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden flex flex-col items-center justify-center p-8 text-center text-white border border-slate-900 shadow-2xl">
        <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mb-3 text-amber-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
        <h3 className="text-lg font-black tracking-tight mb-1 text-slate-200">Video is still processing</h3>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
          The video lesson is currently being encoded and optimized by Bunny Stream. Please check back in a few minutes.
        </p>
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden flex flex-col items-center justify-center p-8 text-center text-white border border-slate-900 shadow-2xl">
        <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center mb-3 text-slate-400">
          <VideoOff className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black tracking-tight mb-1 text-slate-200">Video is not available yet</h3>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
          The video lesson for this module is being processed or will be uploaded shortly by your trainer.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="relative w-full aspect-video bg-slate-950 rounded-3xl overflow-hidden flex flex-col items-center justify-center p-8 text-center text-white border border-slate-900 shadow-2xl space-y-3">
        <div className="w-16 h-16 bg-rose-500/20 border border-rose-500/40 rounded-full flex items-center justify-center text-rose-400">
          <VideoOff className="w-8 h-8" />
        </div>
        <div className="space-y-1 max-w-sm text-center">
          <h3 className="text-lg font-black tracking-tight text-slate-200">Video Loading Timed Out</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The video stream did not start within 30 seconds. Click retry to refresh access token or stream.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading Video</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full aspect-video rounded-xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-900 bg-slate-950 select-none"
    >
      {/* Bunny Stream Embed Player iframe */}
      <iframe
        key={replayKey}
        ref={iframeRef}
        src={embedUrl}
        title={videoTitle || courseTitle || 'Recorded Lesson Video'}
        onLoad={handleIframeLoad}
        loading="lazy"
        className="w-full h-full border-0 absolute inset-0 z-10"
        allow="autoplay; fullscreen; picture-in-picture"
      />

      {/* DYNAMIC MOVING WATERMARK OVERLAY: Email only, real casing, semi-transparent, pointer-events none */}
      {authenticatedEmail && (
        <div
          style={{ top: watermarkPos.top, left: watermarkPos.left }}
          className="absolute pointer-events-none transition-all duration-1000 ease-in-out bg-black/40 backdrop-blur-xs px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-white/10 text-[10px] sm:text-xs font-mono font-medium text-white/70 shadow-lg z-20 flex items-center gap-1.5 select-none max-w-[85vw] truncate"
        >
          <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{authenticatedEmail}</span>
        </div>
      )}

      {/* Optional Top Header Bar */}
      <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-slate-950/80 to-transparent pointer-events-none z-20 flex items-center justify-between text-white opacity-0 hover:opacity-100 transition-opacity">
        <div className="text-xs font-black truncate max-w-md">
          {videoTitle || 'Private Recorded Lesson'}
        </div>
        <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
          🔒 SECURE EMBED STREAM
        </div>
      </div>
    </div>
  );
}
