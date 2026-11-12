import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminFeedbackSectionTab from './components/admin/AdminFeedbackSectionTab';
import * as feedbackApi from './api/feedbackMediaApi';

// Mock dialog context
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockConfirm = vi.fn();

vi.mock('./context/DialogContext', () => ({
  useDialog: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    confirm: mockConfirm
  })
}));

vi.mock('./api/feedbackMediaApi', () => ({
  getAllFeedbackMedia: vi.fn(),
  uploadFeedbackMedia: vi.fn(),
  updateFeedbackMediaOrder: vi.fn(),
  deleteFeedbackMedia: vi.fn(),
  getFeedbackMediaStatus: vi.fn(),
  getFeedbackVideoPlayback: vi.fn()
}));

describe('AdminFeedbackSectionTab Component Tests (Task H3.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Up/down reorder boundaries and unsaved order changes', async () => {
    const mockItems = [
      { id: 'f1', originalFileName: 'photo1.jpg', mediaType: 'IMAGE', status: 'READY', sizeBytes: 1024, sortOrder: 0, url: '/img1.jpg' },
      { id: 'f2', originalFileName: 'photo2.jpg', mediaType: 'IMAGE', status: 'READY', sizeBytes: 2048, sortOrder: 1, url: '/img2.jpg' },
      { id: 'f3', originalFileName: 'video3.mp4', mediaType: 'VIDEO', status: 'READY', sizeBytes: 5000, sortOrder: 2, thumbnailUrl: '/v3.jpg' }
    ];

    feedbackApi.getAllFeedbackMedia.mockResolvedValue({ success: true, data: mockItems });
    const onUnsavedChange = vi.fn();

    render(<AdminFeedbackSectionTab onUnsavedChange={onUnsavedChange} />);

    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('photo1.jpg')).toBeDefined();
    });

    // Check save order button initially disabled
    const saveBtn = screen.getByRole('button', { name: /Order Saved/i });
    expect(saveBtn.disabled).toBe(true);

    // The first item should have Up disabled
    const moveUpButtons = screen.getAllByTitle('Move Up');
    const moveDownButtons = screen.getAllByTitle('Move Down');

    expect(moveUpButtons[0].disabled).toBe(true);
    expect(moveDownButtons[0].disabled).toBe(false);

    // The last item should have Down disabled
    expect(moveDownButtons[2].disabled).toBe(true);
    expect(moveUpButtons[2].disabled).toBe(false);

    // Click Move Down on first item (photo1.jpg)
    fireEvent.click(moveDownButtons[0]);

    // Save button should now be enabled and say "Save Order Changes"
    const activeSaveBtn = screen.getByRole('button', { name: /Save Order Changes/i });
    expect(activeSaveBtn.disabled).toBe(false);
    expect(onUnsavedChange).toHaveBeenCalledWith(true);

    // Save order API call
    feedbackApi.updateFeedbackMediaOrder.mockResolvedValue({ success: true, data: [] });
    fireEvent.click(activeSaveBtn);

    await waitFor(() => {
      expect(feedbackApi.updateFeedbackMediaOrder).toHaveBeenCalledWith(['f2', 'f1', 'f3']);
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Feedback gallery order saved successfully.',
        'Order Saved'
      );
    });
  });

  it('2. Immediate UI rejection of audio files', async () => {
    feedbackApi.getAllFeedbackMedia.mockResolvedValue({ success: true, data: [] });

    const { container } = render(<AdminFeedbackSectionTab />);

    await waitFor(() => {
      expect(screen.getByText(/Feedback Gallery Media Management/i)).toBeDefined();
    });

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeDefined();

    // Attempt uploading an MP3 audio file
    const audioFile = new File(['fake audio bytes'], 'voice_note.mp3', { type: 'audio/mpeg' });
    fireEvent.change(fileInput, { target: { files: [audioFile] } });

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('is an audio file. Audio files are not supported'),
        'Audio File Rejected'
      );
      expect(feedbackApi.uploadFeedbackMedia).not.toHaveBeenCalled();
    });
  });

  it('3. Video preview fetches playback token and opens modal with embedUrl', async () => {
    const mockItems = [
      {
        id: 'fbm_video_1',
        originalFileName: 'testimonial.mp4',
        mediaType: 'VIDEO',
        status: 'READY',
        sizeBytes: 15000000,
        sortOrder: 0,
        bunnyVideoId: 'bunny-vid-123',
        thumbnailUrl: 'https://vz-cdn.net/bunny-vid-123/thumbnail.jpg'
      }
    ];

    feedbackApi.getAllFeedbackMedia.mockResolvedValue({ success: true, data: mockItems });
    feedbackApi.getFeedbackVideoPlayback.mockResolvedValue({
      success: true,
      data: {
        videoId: 'bunny-vid-123',
        embedUrl: 'https://iframe.mediadelivery.net/embed/784226/bunny-vid-123?token=mocktoken&expires=1999999999',
        streamUrl: 'https://video.bunnycdn.com/play/bunny-vid-123',
        authorized: true
      }
    });

    render(<AdminFeedbackSectionTab />);

    await waitFor(() => {
      expect(screen.getByText('testimonial.mp4')).toBeDefined();
    });

    const previewBtn = screen.getByTitle('Preview Large');
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(feedbackApi.getFeedbackVideoPlayback).toHaveBeenCalledWith('fbm_video_1');
    });

    // Check modal displays iframe
    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute('src')).toContain('iframe.mediadelivery.net/embed/784226/bunny-vid-123');
    });
  });
});
