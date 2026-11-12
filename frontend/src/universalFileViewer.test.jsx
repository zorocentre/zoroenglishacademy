import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import UniversalFileViewerModal from './components/common/UniversalFileViewerModal';

describe('UniversalFileViewerModal and Preview Button Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders download button when hideDownload is false (Admin Mode) on left down corner', () => {
    const file = {
      url: '/api/files/test-file-id.pdf',
      name: 'Curriculum_Guide.pdf',
      type: 'pdf',
      size: '250 KB'
    };

    render(
      <UniversalFileViewerModal
        isOpen={true}
        onClose={vi.fn()}
        file={file}
        hideDownload={false}
      />
    );

    expect(screen.getByText('Curriculum_Guide.pdf')).toBeDefined();
    const downloadBtn = screen.getByRole('button', { name: /Download/i });
    expect(downloadBtn).toBeTruthy();
  });

  it('2. Does NOT render download button when hideDownload is true (Student / Trainer Mode)', () => {
    const file = {
      url: '/api/files/test-file-id.pdf',
      name: 'Study_Material.pdf',
      type: 'pdf',
      size: '150 KB'
    };

    render(
      <UniversalFileViewerModal
        isOpen={true}
        onClose={vi.fn()}
        file={file}
        hideDownload={true}
      />
    );

    expect(screen.getByText('Study_Material.pdf')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Download/i })).toBeNull();
  });

  it('3. CourseContentPage renders Preview buttons for attached module resources', async () => {
    const realCourseFixture = (await import('./test/fixtures/real-course-module.json')).default;
    const { MemoryRouter } = await import('react-router-dom');
    const { DialogProvider } = await import('./context/DialogContext');
    const CourseContentPage = (await import('./components/admin/CourseContentPage')).default;
    const { waitFor } = await import('@testing-library/react');

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/courses/')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => realCourseFixture,
          text: async () => JSON.stringify(realCourseFixture)
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true, data: {} }),
        text: async () => JSON.stringify({ success: true, data: {} })
      };
    }));

    render(
      <MemoryRouter>
        <DialogProvider>
          <CourseContentPage courseId={realCourseFixture.data.id} />
        </DialogProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Task 2 Test Module')).toBeDefined();
    });

    const previewButtons = screen.getAllByRole('button', { name: /Preview/i });
    expect(previewButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('4. Renders Bunny Stream iframe player when file.embedUrl is provided', () => {
    const videoFile = {
      name: 'testimonial.mp4',
      contentType: 'video/mp4',
      mediaType: 'VIDEO',
      embedUrl: 'https://iframe.mediadelivery.net/embed/784226/bunny-vid-123?token=mock&expires=9999999999',
      size: '12 MB'
    };

    render(
      <UniversalFileViewerModal
        isOpen={true}
        onClose={vi.fn()}
        file={videoFile}
        hideDownload={true}
      />
    );

    expect(screen.getByText('testimonial.mp4')).toBeDefined();
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('src')).toContain('iframe.mediadelivery.net/embed/784226/bunny-vid-123');
  });
});
