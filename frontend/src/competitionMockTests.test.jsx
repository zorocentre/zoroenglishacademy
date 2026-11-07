import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CompetitionMockTestsPage from './components/competition/CompetitionMockTestsPage';
import * as competitionApi from './api/competitionApi';

vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    currentCompetition: {
      id: 'comp_test_123',
      title: 'National English Olympiad 2026',
    },
  }),
}));

describe('CompetitionMockTestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 4 mock test cards with LIVE, UPCOMING, and EXPIRED statuses', async () => {
    const mockData = {
      competitionId: 'comp_test_123',
      competitionTitle: 'National English Olympiad 2026',
      mockTests: [
        {
          id: 'asmt_mock_1',
          sequenceNo: 1,
          title: 'Championship Mock 1',
          durationMinutes: 45,
          totalMarks: 50,
          status: 'PUBLISHED',
          windowStatus: 'LIVE',
          attemptStatus: 'NOT_STARTED',
          secondsToEnd: 1800,
          startAt: new Date(Date.now() - 600000).toISOString(),
          endAt: new Date(Date.now() + 1800000).toISOString(),
        },
        {
          id: 'asmt_mock_2',
          sequenceNo: 2,
          title: 'Championship Mock 2',
          durationMinutes: 45,
          totalMarks: 50,
          status: 'PUBLISHED',
          windowStatus: 'UPCOMING',
          attemptStatus: 'UPCOMING_LOCKED',
          secondsToStart: 7200,
          startAt: new Date(Date.now() + 7200000).toISOString(),
          endAt: new Date(Date.now() + 9900000).toISOString(),
        },
        {
          id: 'asmt_mock_3',
          sequenceNo: 3,
          title: 'Championship Mock 3',
          durationMinutes: 45,
          totalMarks: 50,
          status: 'PUBLISHED',
          windowStatus: 'EXPIRED',
          attemptStatus: 'MISSED',
          startAt: new Date(Date.now() - 10000000).toISOString(),
          endAt: new Date(Date.now() - 5000000).toISOString(),
        },
        {
          id: 'asmt_mock_4',
          sequenceNo: 4,
          title: 'Championship Mock 4',
          durationMinutes: 45,
          totalMarks: 50,
          status: 'DRAFT',
          windowStatus: 'DRAFT',
          attemptStatus: 'UNPUBLISHED',
        },
      ],
    };

    vi.spyOn(competitionApi, 'getStudentMockTests').mockResolvedValue({
      success: true,
      data: mockData,
    });

    render(<CompetitionMockTestsPage />);

    // Check heading
    expect(await screen.findByRole('heading', { level: 1, name: /^Mock Tests$/i })).toBeDefined();

    // Check Live Hero Banner
    expect(screen.getByText(/Championship Mock 1 is LIVE NOW!/i)).toBeDefined();
    expect(screen.getByText(/Window Closes In/i)).toBeDefined();

    // Check all 4 cards rendered
    expect(screen.getByTestId('mock-card-1')).toBeDefined();
    expect(screen.getByTestId('mock-card-2')).toBeDefined();
    expect(screen.getByTestId('mock-card-3')).toBeDefined();
    expect(screen.getByTestId('mock-card-4')).toBeDefined();

    // Check buttons
    expect(screen.getByText(/Take Mock Test/i)).toBeDefined();
    expect(screen.getByText(/Locked Until Scheduled Window/i)).toBeDefined();
    expect(screen.getAllByText(/Window Closed/i).length).toBeGreaterThan(0);
  });
});
