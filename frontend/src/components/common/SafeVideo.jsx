import React, { useState, useEffect, useRef } from 'react';
import { Video, Maximize2, Minimize2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveFileUrl } from '../../api/fileApi';

export default function SafeVideo({
  src,
  embedUrl,
  libraryId = '784226',
  poster,
  title = 'Video Player',
  className = '',
  containerClassName = '',
  isIframe = false,
  autoPlay = false,
  controls = true,
  muted = false,
  bunnyVideoId,
  videoRefData,
  onRetry,
  ...rest
}) {
  const { user } = useAuth();
  const authenticatedEmail = user?.email || '';

  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  const isPlayerReadyRef = useRef(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [watermarkPos, setWatermarkPos] = useState({ top: '22%', left: '18%' });
  const [replayKey, setReplayKey] = useState(0);

  // Parse videoRefData if provided
  let refParsed = videoRefData;
  if (typeof videoRefData === 'string' && videoRefData.trim().startsWith('{')) {
    try {
      refParsed = JSON.parse(videoRefData);
    } catch {
      // fallback
    }
  }

  const effectiveBunnyId = bunnyVideoId || refParsed?.bunnyVideoId || refParsed?.videoId || (typeof refParsed === 'string' && !refParsed.startsWith('http') && !refParsed.startsWith('/') ? refParsed : null);
  const effectiveEmbedUrl = embedUrl || refParsed?.embedUrl || (refParsed?.videoId && refParsed?.token ? `https://iframe.mediadelivery.net/embed/${refParsed.libraryId || libraryId}/${refParsed.videoId}?token=${refParsed.token}${refParsed.expiresAt ? `&expires=${refParsed.expiresAt}` : ''}` : null);
  const rawSrc = src || refParsed?.videoUrl || refParsed?.url || '';
  const resolvedSrc = rawSrc ? resolveFileUrl(rawSrc) : '';

  const effectiveIframe = isIframe || Boolean(effectiveBunnyId) || Boolean(effectiveEmbedUrl) || (resolvedSrc && resolvedSrc.includes('mediadelivery.net'));
  const effectiveSrc = effectiveEmbedUrl || (effectiveBunnyId ? (effectiveBunnyId.includes('http') ? effectiveBunnyId : `https://iframe.mediadelivery.net/embed/${libraryId}/${effectiveBunnyId}`) : resolvedSrc);

  // Player.js listener to clear loading timeouts on real player events (ready, play, timeupdate)
  useEffect(() => {
    isPlayerReadyRef.current = false;

    const handleMessage = (event) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data) return;

      // Bunny Player.js protocol events
      if (data.context === 'player.js' || data.event === 'ready' || data.event === 'play' || data.event === 'timeupdate') {
        isPlayerReadyRef.current = true;
        setIsLoaded(true);
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [effectiveSrc, replayKey]);

  // 30-second Loading Timeout Failsafe (Task 10)
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setErrorMsg('');
    isPlayerReadyRef.current = false;

    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    if (!effectiveSrc) {
      const timer = setTimeout(() => {
        setHasError(true);
        setErrorMsg('Video source is not available or missing.');
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 30-second generous timeout: cancel if loaded or player ready
    loadTimeoutRef.current = setTimeout(() => {
      if (!isLoaded && !isPlayerReadyRef.current) {
        console.warn('[SafeVideo] Video loading timed out after 30 seconds for src:', effectiveSrc);
        setHasError(true);
        setErrorMsg('Video playback timed out. Click retry to refresh access token or stream.');
      }
    }, 30000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [effectiveSrc, replayKey]);

  useEffect(() => {
    const topPositions = ['15%', '28%', '58%', '72%', '40%'];
    const leftPositions = ['12%', '55%', '20%', '65%', '38%'];
    const interval = setInterval(() => {
      const t = topPositions[Math.floor(Math.random() * topPositions.length)];
      const l = leftPositions[Math.floor(Math.random() * leftPositions.length)];
      setWatermarkPos({ top: t, left: l });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === containerRef.current));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoaded(false);
    setErrorMsg('');
    isPlayerReadyRef.current = false;
    setReplayKey(prev => prev + 1);
    onRetry?.();
  };

  return (
    <div
      ref={containerRef}
      className={`group/video relative w-full aspect-video overflow-hidden bg-slate-900 rounded-xl ${containerClassName}`}
    >
      {hasError ? (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white z-20 space-y-3">
          <div className="w-12 h-12 bg-rose-500/20 border border-rose-500/40 rounded-full flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-xs font-black text-slate-200">Video Playback Error</h4>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              {errorMsg || 'Unable to stream video. Click retry to reload.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : !isLoaded ? (
        <div
          role="status"
          aria-busy="true"
          className="absolute inset-0 bg-slate-800 animate-pulse flex flex-col items-center justify-center text-slate-500 z-10"
        >
          <Video className="w-10 h-10 mb-2 opacity-50" />
          <span className="text-xs font-semibold">Loading video...</span>
        </div>
      ) : null}

      {/* Floating moving email watermark (Task K11) */}
      {authenticatedEmail && (
        <div
          data-testid="video-email-watermark"
          style={{
            top: watermarkPos.top,
            left: watermarkPos.left,
            transition: 'top 1.8s ease-in-out, left 1.8s ease-in-out',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 6px rgba(0, 0, 0, 0.85)',
          }}
          className="absolute z-30 pointer-events-none select-none text-[11px] font-mono tracking-wider font-semibold text-white/40"
        >
          {authenticatedEmail}
        </div>
      )}

      {/* Custom wrapper fullscreen button to ensure watermark stays visible in fullscreen */}
      <button
        type="button"
        onClick={handleToggleFullscreen}
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        className="absolute top-2 right-2 z-30 p-1.5 rounded-lg bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-xs transition opacity-0 group-hover/video:opacity-100 cursor-pointer"
      >
        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>

      {effectiveSrc && effectiveIframe ? (
        <iframe
          key={replayKey}
          ref={iframeRef}
          src={effectiveSrc}
          title={title}
          className={`absolute inset-0 w-full h-full border-0 object-contain transition-opacity duration-300 ${
            isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          onLoad={() => {
            setIsLoaded(true);
            if (loadTimeoutRef.current) {
              clearTimeout(loadTimeoutRef.current);
            }
          }}
          onError={(e) => {
            console.error('[SafeVideo] iframe load error:', e);
            setHasError(true);
            setErrorMsg('Unable to stream video track. Click retry to refresh access token.');
          }}
          {...rest}
        />
      ) : effectiveSrc ? (
        <video
          key={replayKey}
          src={effectiveSrc}
          poster={poster}
          controls={controls}
          controlsList="nodownload"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          autoPlay={autoPlay}
          muted={muted}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
            isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoadedData={() => {
            setIsLoaded(true);
            if (loadTimeoutRef.current) {
              clearTimeout(loadTimeoutRef.current);
            }
          }}
          onError={(e) => {
            console.error('[SafeVideo] video element error:', e);
            setHasError(true);
            setErrorMsg('Unable to play video file. Click retry to reload.');
          }}
          {...rest}
        />
      ) : null}
    </div>
  );
}
