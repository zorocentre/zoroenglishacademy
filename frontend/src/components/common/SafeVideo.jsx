import React, { useState, useEffect, useRef } from 'react';
import { Video, Maximize2, Minimize2 } from 'lucide-react';
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
  ...rest
}) {
  const { user } = useAuth();
  const authenticatedEmail = user?.email || '';

  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [watermarkPos, setWatermarkPos] = useState({ top: '22%', left: '18%' });

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

  const effectiveIframe = isIframe || Boolean(bunnyVideoId) || Boolean(embedUrl) || (src && src.includes('mediadelivery.net'));
  const resolvedSrc = src ? resolveFileUrl(src) : '';
  const effectiveSrc = embedUrl || (bunnyVideoId ? (bunnyVideoId.includes('http') ? bunnyVideoId : `https://iframe.mediadelivery.net/embed/${libraryId}/${bunnyVideoId}`) : resolvedSrc);

  return (
    <div
      ref={containerRef}
      className={`group/video relative w-full aspect-video overflow-hidden bg-slate-900 rounded-xl ${containerClassName}`}
    >
      {!isLoaded && (
        <div
          role="status"
          aria-busy="true"
          className="absolute inset-0 bg-slate-800 animate-pulse flex flex-col items-center justify-center text-slate-500 z-10"
        >
          <Video className="w-10 h-10 mb-2 opacity-50" />
          <span className="text-xs font-semibold">Loading video...</span>
        </div>
      )}

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

      {effectiveIframe ? (
        <iframe
          src={effectiveSrc}
          title={title}
          className={`absolute inset-0 w-full h-full border-0 object-contain transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          onLoad={() => setIsLoaded(true)}
          {...rest}
        />
      ) : (
        <video
          src={effectiveSrc}
          poster={poster}
          controls={controls}
          controlsList="nodownload"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          autoPlay={autoPlay}
          muted={muted}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoadedData={() => setIsLoaded(true)}
          {...rest}
        />
      )}
    </div>
  );
}
