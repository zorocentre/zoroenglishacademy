import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CompetitionTestSeriesPage from './components/competition/CompetitionTestSeriesPage';
import * as compApi from './api/competitionApi';

// Mock react-router-dom outlet context
vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    currentCompetition: {
      id: 'comp_test_1',
      title: 'National English Olympiad 2026'
    }
  })
}));

describe('CompetitionTestSeriesPage (Phase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders test series list with all 35 slots and handles start test', async () => {
    const mockTests = [
      {
        id: 'asmt_1',
        sequenceNo: 1,
        title: 'Test Series 1',
        type: 'TEST_SERIES',
        status: 'PUBLISHED',
        attemptStatus: 'NOT_STARTED',
        durationMinutes: 20,
        totalMarks: 20,
        questionCount: 2
      },
      {
        id: 'asmt_2',
        sequenceNo: 2,
        title: 'Test Series 2',
        type: 'TEST_SERIES',
        status: 'DRAFT',
        attemptStatus: 'UNPUBLISHED',
        durationMinutes: 20,
        totalMarks: 20,
        questionCount: 0
      }
    ];

    vi.spyOn(compApi, 'getStudentTestSeries').mockResolvedValue({
      success: true,
      data: {
        competitionId: 'comp_test_1',
        competitionTitle: 'National English Olympiad 2026',
        testSeries: mockTests,
        serverNow: new Date().toISOString()
      }
    });

    vi.spyOn(compApi, 'startTestSeriesAttempt').mockResolvedValue({
      success: true,
      data: {
        attempt: { id: 'att_1', status: 'IN_PROGRESS' },
        assessment: mockTests[0],
        questions: [
          {
            id: 'q_1',
            questionText: 'What is the synonym of Benevolent?',
            questionFormat: 'MCQ',
            answerFormat: 'MCQ_OPTIONS',
            marks: 2,
            options: [
              { id: 'opt_1', text: 'Kind', sortOrder: 0 },
              { id: 'opt_2', text: 'Cruel', sortOrder: 1 }
            ]
          }
        ],
        answers: {},
        serverNow: new Date().toISOString()
      }
    });

    render(<CompetitionTestSeriesPage />);

    expect(await screen.findByRole('heading', { level: 1, name: /^Competition Test Series$/i })).toBeDefined();
    expect(screen.getByText('Test Series 1')).toBeDefined();
    expect(screen.getByText('Test Series 2')).toBeDefined();
    expect(screen.getByText('Coming soon')).toBeDefined();

    const startBtn = screen.getByText('Start Test');
    expect(startBtn).toBeDefined();

    fireEvent.click(startBtn);

    // Should load the test taker view
    expect(await screen.findByText('What is the synonym of Benevolent?')).toBeDefined();
    expect(screen.getByText('Kind')).toBeDefined();
    expect(screen.getByText('Cruel')).toBeDefined();
  });
});

