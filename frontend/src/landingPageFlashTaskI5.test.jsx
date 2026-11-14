import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './components/public/HomePage';
import * as websiteSettingsApi from './api/websiteSettingsApi';
import * as courseApi from './api/courseApi';
import * as feedbackMediaApi from './api/feedbackMediaApi';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

vi.mock('./context/DialogContext', () => ({
  useDialog: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true)
  })
}));

vi.mock('./api/courseApi', () => ({
  getPublicCourses: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCourses: vi.fn().mockResolvedValue({ success: true, data: [] })
}));

vi.mock('./api/feedbackMediaApi', () => ({
  getPublishedFeedbackMedia: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getAllFeedbackMedia: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getFeedbackVideoPlayback: vi.fn()
}));

describe('Task I5: Landing Page Fallback Flash Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Shows PageLoader and does NOT flash hardcoded marketing copy while settings are loading', async () => {
    let resolveSettings;
    const settingsPromise = new Promise(resolve => {
      resolveSettings = resolve;
    });

    vi.spyOn(websiteSettingsApi, 'getWebsiteSettings').mockReturnValue(settingsPromise);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // PageLoader must be present
    expect(screen.getByRole('status', { hidden: true }) || screen.getByText(/Loading/i) || document.querySelector('.animate-spin')).toBeTruthy();

    // Stale marketing copy must NOT be present in DOM during load
    expect(screen.queryByText('Skills for a Brighter Tomorrow')).toBeNull();
    expect(screen.queryByText(/Build skills\. Boost confidence\./i)).toBeNull();
    expect(screen.queryByText(/Empowering children with lifelong cognitive abilities/i)).toBeNull();

    // Now resolve settings
    resolveSettings({
      success: true,
      data: {
        landingPageContent: {
          heroHeading: 'Custom DB Headline',
          heroDescription: 'Custom DB Subtitle',
          featuresTitle: 'Custom Programs',
          spotlightTitle: 'Custom Spotlight'
        }
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Custom DB Headline')).toBeDefined();
      expect(screen.getByText('Custom DB Subtitle')).toBeDefined();
    });
  });
});
