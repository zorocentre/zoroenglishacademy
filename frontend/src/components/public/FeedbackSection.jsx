import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Quote } from 'lucide-react';
import { getPublishedFeedbackMedia, getFeedbackVideoPlayback } from '../../api/feedbackMediaApi';
import { resolveFileUrl } from '../../api/fileApi';
import playerjs from 'player.js';

export default function FeedbackSection({ initialItems = null }) {
  const [items, setItems] = useState(initialItems || []);
  const [isLoading, setIsLoading] = useState(!initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState(0);
  const [failedItemIds, setFailedItemIds] = useState(() => new Set());
  const [playbackCache, setPlaybackCache] = useState({});

  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const countRef = useRef(0);

  // Load published items if not provided via props
  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      setIsLoading(false);
      return;
    }
    let isMounted = true;
    getPublishedFeedbackMedia()
      .then((res) => {
        if (isMounted) {
          if (res && res.success && Array.isArray(res.data)) {
            setItems(res.data);
          } else {
            setItems([]);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setItems([]);
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [initialItems]);

  const validItems = items.filter((item) => item && item.id && !failedItemIds.has(item.id));
  const count = validItems.length;
  // Keep countRef updated
  useEffect(() => {
    countRef.current = validItems.length;
  }, [validItems.length]);

  // Clamp current index if items change
  useEffect(() => {
    if (count > 0 && currentIndex >= count) {
      setCurrentIndex(0);
    }
  }, [count, currentIndex]);

  const currentItem = validItems[currentIndex] || null;

  // Fetch playback auth for current video if needed
  useEffect(() => {
    if (!currentItem || currentItem.mediaType !== 'VIDEO') return;
    if (playbackCache[currentItem.id]) return;

    let active = true;
    getFeedbackVideoPlayback(currentItem.id)
      .then((res) => {
        if (active && res && res.success && res.data) {
          setPlaybackCache((prev) => ({
            ...prev,
            [currentItem.id]: res.data
          }));
        }
      })
      .catch((err) => {
        console.debug('Failed to get playback authorization:', err);
      });

    return () => {
      active = false;
    };
  }, [currentItem, playbackCache]);

  // Setup player.js event listener on the Bunny Stream iframe player
  useEffect(() => {
    if (!currentItem || currentItem.mediaType !== 'VIDEO') {
      setIsVideoPlaying(false);
      return;
    }

    const currentIframe = iframeRef.current;
    if (!currentIframe) return;

    try {
      const player = new playerjs.Player(currentIframe);
      playerRef.current = player;

      const onPlay = () => setIsVideoPlaying(true);
      const onPause = () => setIsVideoPlaying(false);
      const onEnded = () => {
        setIsVideoPlaying(false);
        if (countRef.current > 1) {
          setCurrentIndex((prev) => (prev + 1) % countRef.current);
          setTimerResetKey((k) => k + 1);
        }
      };

      player.on('play', onPlay);
      player.on('pause', onPause);
      player.on('ended', onEnded);

      return () => {
        try {
          player.off('play', onPlay);
          player.off('pause', onPause);
          player.off('ended', onEnded);
        } catch {
          // ignore cleanup errors
        }
        playerRef.current = null;
      };
    } catch {
      // player.js init fallback
    }
  }, [currentItem, currentIndex]);

  // Navigation handlers
  const nextSlide = useCallback(() => {
    if (countRef.current <= 1) return;
    setIsVideoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % countRef.current);
    setTimerResetKey((k) => k + 1);
  }, []);

  const prevSlide = useCallback(() => {
    if (countRef.current <= 1) return;
    setIsVideoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + countRef.current) % countRef.current);
    setTimerResetKey((k) => k + 1);
  }, []);

  const selectSlide = useCallback((index) => {
    setIsVideoPlaying(false);
    setCurrentIndex(index);
    setTimerResetKey((k) => k + 1);
  }, []);

  // 5-second auto-advance timer
  useEffect(() => {
    if (count <= 1 || isVideoPlaying || isDocumentHidden) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(interval);
  }, [count, isVideoPlaying, isDocumentHidden, timerResetKey, nextSlide]);

  // Pause when document tab is hidden and resume cleanly
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsDocumentHidden(true);
        if (playerRef.current && isVideoPlaying) {
          try {
            playerRef.current.pause();
          } catch {
            // ignore
          }
        }
      } else {
        setIsDocumentHidden(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isVideoPlaying]);

  // If loading or no items, return null (Task H4.6: section NOT rendered at all)
  if (isLoading || count === 0 || !currentItem) {
    return null;
  }

  const isVideo = currentItem.mediaType === 'VIDEO';
  const playbackData = isVideo ? playbackCache[currentItem.id] : null;

  return (
    <section
      id="feedback"
      data-testid="feedback-section"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20"
    >
      {/* Section Heading */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200/60 text-xs font-extrabold text-blue-700 mb-3">
          <Quote className="w-3.5 h-3.5 text-blue-600" />
          <span>Real Experiences & Testimonials</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Feedback
        </h2>
        <p className="text-slate-500 text-sm mt-2">
          Discover how Zoro Academy inspires young learners through passionate educators and structured skill development.
        </p>
      </div>

      {/* Main 16:9 Frame Container */}
      <div className="max-w-4xl mx-auto relative group">
        <div
          data-testid="feedback-gallery-frame"
          className="relative aspect-video w-full rounded-3xl overflow-hidden bg-slate-950 shadow-2xl border border-slate-200/80 flex items-center justify-center"
        >
          {isVideo ? (
            /* Video Slide */
            <div className="w-full h-full relative z-10 flex items-center justify-center bg-black">
              {playbackData?.embedUrl ? (
                <iframe
                  ref={iframeRef}
                  src={`${playbackData.embedUrl}&autoplay=false&preload=true&responsive=true`}
                  title={currentItem.originalFileName || 'Feedback Video'}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  className="w-full h-full border-0"
                  data-testid="feedback-video-iframe"
                />
              ) : playbackData?.streamUrl ? (
                <video
                  src={playbackData.streamUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  onEnded={() => {
                    setIsVideoPlaying(false);
                    nextSlide();
                  }}
                  data-testid="feedback-video-element"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs font-semibold">Preparing video playback...</span>
                </div>
              )}
            </div>
          ) : (
            /* Image Slide: Soft Blurred Background + Object-Contain Foreground (Task H4.3) */
            <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
              {/* Blurred Ambient Backdrop */}
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-xl opacity-35 scale-110 pointer-events-none"
                style={{
                  backgroundImage: `url(${resolveFileUrl(currentItem.url)})`
                }}
              />
              {/* Dark subtle overlay for contrast */}
              <div className="absolute inset-0 bg-slate-950/20 pointer-events-none" />
              {/* Foreground Image with object-contain to prevent cropping */}
              <img
                src={resolveFileUrl(currentItem.url)}
                alt={currentItem.originalFileName || 'Feedback Photo'}
                className="relative z-10 w-full h-full object-contain mx-auto select-none"
                loading={currentIndex === 0 ? 'eager' : 'lazy'}
                data-testid="feedback-slide-image"
                onError={() => {
                  setFailedItemIds((prev) => {
                    const next = new Set(prev);
                    next.add(currentItem.id);
                    return next;
                  });
                }}
              />
            </div>
          )}

          {/* Left Navigation Arrow (shown only when 2+ items) */}
          {count > 1 && (
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous feedback item"
              data-testid="feedback-prev-btn"
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg backdrop-blur-xs transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}

          {/* Right Navigation Arrow (shown only when 2+ items) */}
          {count > 1 && (
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next feedback item"
              data-testid="feedback-next-btn"
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg backdrop-blur-xs transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
        </div>

        {/* Dots Indicator (shown only when 2+ items) */}
        {count > 1 && (
          <div
            className="flex justify-center items-center gap-2 mt-5"
            data-testid="feedback-dots"
          >
            {validItems.map((item, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={item.id || idx}
                  type="button"
                  onClick={() => selectSlide(idx)}
                  aria-label={`Jump to feedback slide ${idx + 1}`}
                  data-testid={`feedback-dot-${idx}`}
                  className={`transition-all rounded-full cursor-pointer h-2 ${
                    isSelected
                      ? 'w-6 bg-blue-600 shadow-sm'
                      : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
