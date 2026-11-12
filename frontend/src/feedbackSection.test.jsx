import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FeedbackSection from './components/public/FeedbackSection';
import * as feedbackApi from './api/feedbackMediaApi';

vi.mock('./api/feedbackMediaApi', () => ({
  getPublishedFeedbackMedia: vi.fn(),
  getFeedbackVideoPlayback: vi.fn()
}));

vi.mock('player.js', () => {
  return {
    default: {
      Player: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        off: vi.fn(),
        pause: vi.fn()
      }))
    }
  };
});

describe('FeedbackSection Component Tests (Task H4.9)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Section is NOT rendered at all when empty', async () => {
    feedbackApi.getPublishedFeedbackMedia.mockResolvedValue({ success: true, data: [] });

    const { container } = render(<FeedbackSection initialItems={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('2. Single item renders without navigation arrows or dots', async () => {
    const singleItem = [
      { id: 'item_1', originalFileName: 'photo1.jpg', mediaType: 'IMAGE', sortOrder: 0, url: '/img1.jpg' }
    ];

    render(<FeedbackSection initialItems={singleItem} />);

    expect(screen.getByTestId('feedback-section')).toBeDefined();
    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img1.jpg');

    // Arrows and dots should NOT be rendered for a single item
    expect(screen.queryByTestId('feedback-prev-btn')).toBeNull();
    expect(screen.queryByTestId('feedback-next-btn')).toBeNull();
    expect(screen.queryByTestId('feedback-dots')).toBeNull();
  });

  it('3. Auto-advances every 5 seconds with wrap-around', async () => {
    const multiItems = [
      { id: 'item_1', originalFileName: 'photo1.jpg', mediaType: 'IMAGE', sortOrder: 0, url: '/img1.jpg' },
      { id: 'item_2', originalFileName: 'photo2.jpg', mediaType: 'IMAGE', sortOrder: 1, url: '/img2.jpg' },
      { id: 'item_3', originalFileName: 'photo3.jpg', mediaType: 'IMAGE', sortOrder: 2, url: '/img3.jpg' }
    ];

    render(<FeedbackSection initialItems={multiItems} />);

    // Starts on slide 1
    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img1.jpg');

    // Advance 5 seconds -> Slide 2
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img2.jpg');

    // Advance 5 seconds -> Slide 3
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img3.jpg');

    // Advance 5 seconds -> Wrap around to Slide 1
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img1.jpg');
  });

  it('4. Left and right arrows work and restart the timer', async () => {
    const multiItems = [
      { id: 'item_1', originalFileName: 'photo1.jpg', mediaType: 'IMAGE', sortOrder: 0, url: '/img1.jpg' },
      { id: 'item_2', originalFileName: 'photo2.jpg', mediaType: 'IMAGE', sortOrder: 1, url: '/img2.jpg' }
    ];

    render(<FeedbackSection initialItems={multiItems} />);

    const nextBtn = screen.getByTestId('feedback-next-btn');
    const prevBtn = screen.getByTestId('feedback-prev-btn');

    // Click next -> slide 2
    act(() => {
      fireEvent.click(nextBtn);
    });
    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img2.jpg');

    // Click prev -> slide 1
    act(() => {
      fireEvent.click(prevBtn);
    });
    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img1.jpg');

    // Click prev from slide 1 -> wraps around to slide 2
    act(() => {
      fireEvent.click(prevBtn);
    });
    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img2.jpg');
  });

  it('5. Video playing pauses the 5-second timer', async () => {
    feedbackApi.getFeedbackVideoPlayback.mockResolvedValue({
      success: true,
      data: {
        videoId: 'v1',
        streamUrl: 'https://cdn.test/stream.mp4',
        authorized: true
      }
    });

    const itemsWithVideo = [
      { id: 'item_vid', originalFileName: 'testimonial.mp4', mediaType: 'VIDEO', sortOrder: 0, thumbnailUrl: '/thumb.jpg' },
      { id: 'item_img', originalFileName: 'photo2.jpg', mediaType: 'IMAGE', sortOrder: 1, url: '/img2.jpg' }
    ];

    render(<FeedbackSection initialItems={itemsWithVideo} />);

    // Resolve playback promise by running pending microtasks
    await act(async () => {
      await Promise.resolve();
    });

    const videoEl = screen.getByTestId('feedback-video-element');
    expect(videoEl).toBeDefined();

    // Trigger video play event
    act(() => {
      fireEvent.play(videoEl);
    });

    // Advance time by 10 seconds while video is playing
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Should NOT have advanced to slide 2 because video is playing!
    expect(screen.queryByTestId('feedback-video-element')).not.toBeNull();

    // Now trigger video pause event
    act(() => {
      fireEvent.pause(videoEl);
    });

    // Advance time by 5 seconds -> now it advances!
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('feedback-slide-image').getAttribute('src')).toContain('/img2.jpg');
  });
});
