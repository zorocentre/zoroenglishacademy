import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Public Hero Background Component with 0, 1, or >1 image handling:
 * - 0 images: Neutral brand gradient (no stock/Unsplash photos)
 * - 1 image: Static cover background with dark overlay, no animation/timer/arrows/dots
 * - >1 images: Automatic crossfade rotation every `intervalSeconds` (default 5s).
 *   - Preloads all images; skips failed images automatically.
 *   - Stable interval with functional updates.
 *   - Left / Right chevron navigation arrows (purple/brand, vertically centered).
 *   - Clicking arrows or dots changes image immediately and resets the 5s timer.
 *   - Loop around at the ends. Auto-advance keeps running afterwards.
 *   - Dot indicators at the bottom.
 *   - Pauses on document.hidden, resumes and advances on document becoming visible.
 *   - Touch-friendly swipe support on mobile devices.
 *   - Respects admin-configured sortOrder.
 */
export default function HeroCarousel({
  images = [],
  intervalSeconds = 5,
  randomStart = false,
  children
}) {
  const [failedUrls, setFailedUrls] = useState(() => new Set());

  // Filter valid, active, non-failed images and preserve admin sortOrder
  const validImages = useMemo(() => {
    return (images || [])
      .filter((img) => img && img.active !== false && img.url && !failedUrls.has(img.url))
      .slice()
      .sort((a, b) => {
        const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : (typeof a.displayOrder === 'number' ? a.displayOrder : 0);
        const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : (typeof b.displayOrder === 'number' ? b.displayOrder : 0);
        return orderA - orderB;
      });
  }, [images, failedUrls]);

  const count = validImages.length;

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (count > 1 && randomStart) {
      return Math.floor(Math.random() * count);
    }
    return 0;
  });

  const [timerResetKey, setTimerResetKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef(null);
  const countRef = useRef(count);
  countRef.current = count;

  // Preload all valid images on mount / list update and catch errors
  useEffect(() => {
    if (!images || images.length === 0) return;
    images.forEach((img) => {
      if (!img?.url || failedUrls.has(img.url)) return;
      try {
        const tester = new Image();
        tester.src = img.url;
        tester.onerror = () => {
          setFailedUrls((prev) => {
            const next = new Set(prev);
            next.add(img.url);
            return next;
          });
        };
      } catch {
        // ignore in non-browser env
      }
    });
  }, [images, failedUrls]);

  // Clamp index if count changes
  useEffect(() => {
    if (count > 0 && currentIndex >= count) {
      setCurrentIndex(0);
    }
  }, [count, currentIndex]);

  // Stable next slide transition
  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => {
      const c = countRef.current;
      if (c <= 1) return 0;
      return (prev + 1) % c;
    });
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => {
      const c = countRef.current;
      if (c <= 1) return 0;
      return (prev - 1 + c) % c;
    });
  }, []);

  // Manual navigation handlers that reset the auto-advance timer
  const handleNext = useCallback(() => {
    nextSlide();
    setTimerResetKey((k) => k + 1);
  }, [nextSlide]);

  const handlePrev = useCallback(() => {
    prevSlide();
    setTimerResetKey((k) => k + 1);
  }, [prevSlide]);

  const handleSelectIndex = useCallback((idx) => {
    setCurrentIndex(idx);
    setTimerResetKey((k) => k + 1);
  }, []);

  // Auto-advance timer: advances every `intervalSeconds`, resets on manual interaction (timerResetKey)
  useEffect(() => {
    if (count <= 1 || isPaused) return;

    const ms = Math.max(1, intervalSeconds) * 1000;
    const interval = setInterval(() => {
      nextSlide();
    }, ms);

    return () => clearInterval(interval);
  }, [count, isPaused, intervalSeconds, timerResetKey, nextSlide]);

  // Pause carousel when document is hidden; resume AND advance immediately on visibilitychange
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
        if (countRef.current > 1) {
          nextSlide();
          setTimerResetKey((k) => k + 1);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [nextSlide]);

  // Touch swipe handling
  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null || count <= 1) return;
    const touchEndX = e.changedTouches?.[0]?.clientX;
    if (touchEndX !== undefined) {
      const diff = touchStartXRef.current - touchEndX;
      if (diff > 50) {
        handleNext();
      } else if (diff < -50) {
        handlePrev();
      }
    }
    touchStartXRef.current = null;
  };

  // Case 0: No images -> Neutral brand gradient
  if (count === 0) {
    return (
      <section className="relative text-white overflow-hidden py-16 md:py-24 min-h-[500px] flex items-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/30" />
        <div className="relative z-10 w-full">{children}</div>
      </section>
    );
  }

  // Case 1: Exactly 1 image -> Static cover background, no animation, no arrows/dots
  if (count === 1) {
    const single = validImages[0];
    return (
      <section className="relative text-white overflow-hidden py-16 md:py-24 min-h-[500px] flex items-center">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={single.url}
            alt={single.altText || 'Zoro Academy Hero'}
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/30" />
        <div className="relative z-10 w-full">{children}</div>
      </section>
    );
  }

  // Case > 1: Crossfade Carousel
  return (
    <section
      className="relative text-white overflow-hidden py-16 md:py-24 min-h-[500px] flex items-center select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="hero-carousel-section"
      data-current-index={currentIndex}
    >
      {/* Background Slides with Crossfade */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950">
        {validImages.map((image, idx) => {
          const isCurrent = idx === currentIndex;
          return (
            <div
              key={image.id || image.url || idx}
              data-testid={`hero-slide-${idx}`}
              className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
                isCurrent ? 'opacity-100 z-1' : 'opacity-0 z-0 pointer-events-none'
              }`}
              aria-hidden={!isCurrent}
            >
              <img
                src={image.url}
                alt={image.altText || `Zoro Academy Hero Slide ${idx + 1}`}
                className="w-full h-full object-cover object-center"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </div>
          );
        })}
      </div>

      {/* Dark gradient overlay keeping typography readable */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/30" />

      {/* Hero content */}
      <div className="relative z-10 w-full">{children}</div>

      {/* Left Chevron Button */}
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Previous slide"
        data-testid="hero-prev-btn"
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg backdrop-blur-xs transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Right Chevron Button */}
      <button
        type="button"
        onClick={handleNext}
        aria-label="Next slide"
        data-testid="hero-next-btn"
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg backdrop-blur-xs transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Small Indicator Dots */}
      <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center items-center gap-2">
        {validImages.map((image, idx) => {
          const isSelected = idx === currentIndex;
          return (
            <button
              key={image.id || image.url || idx}
              type="button"
              onClick={() => handleSelectIndex(idx)}
              aria-label={`Jump to hero slide ${idx + 1}`}
              data-testid={`hero-dot-${idx}`}
              className={`transition-all rounded-full cursor-pointer h-2 ${
                isSelected ? 'w-6 bg-purple-500 shadow-sm' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
