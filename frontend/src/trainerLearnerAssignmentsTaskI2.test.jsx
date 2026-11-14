import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrainerLearnerAssignmentsPage from './components/trainer/TrainerLearnerAssignmentsPage';
import AssignmentPage from './components/student/AssignmentPage';
import DashboardSidebar from './components/layout/DashboardSidebar';
import * as courseApi from './api/courseApi';
import * as scheduleApi from './api/scheduleApi';
import * as assignmentApi from './api/assignmentApi';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'trainer_test_1', name: 'Test Trainer', email: 'trainer@zoro.com', role: 'TRAINER' }
  })
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
  getMyTrainerCourses: vi.fn(),
  getCourseById: vi.fn()
}));

vi.mock('./api/scheduleApi', () => ({
  getSchedules: vi.fn()
}));

vi.mock('./api/assignmentApi', () => ({
  getTrainerCourseAssignments: vi.fn(),
  getMyTrainerSubmissions: vi.fn(),
  getSubmissions: vi.fn(),
  getCreatedAssignments: vi.fn(),
  createSubmission: vi.fn()
}));

describe('Task I2: Trainer Learner Assignments Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. DashboardSidebar places Trainer\'s Assignments directly after Trainer\'s Courses', () => {
    render(
      <MemoryRouter>
        <DashboardSidebar
          role="TRAINER"
          activeScreen="trainer-learner-assignments"
          onNavigate={vi.fn()}
        />
      </MemoryRouter>
    );

    const buttons = screen.getAllByRole('button');
    const labels = buttons.map(b => b.textContent.trim());

    const coursesIdx = labels.findIndex(l => l.includes("Trainer's Courses"));
    const assignmentsIdx = labels.findIndex(l => l.includes("Trainer's Assignments"));

    expect(coursesIdx).toBeGreaterThanOrEqual(0);
    expect(assignmentsIdx).toBe(coursesIdx + 1);
  });

  it('2. TrainerLearnerAssignmentsPage loads enrolled courses and excludes Extra Assignments tab', async () => {
    courseApi.getMyTrainerCourses.mockResolvedValue({
      success: true,
      data: {
        enrolled: [
          {
            id: 'c1',
            title: 'English Masterclass',
            level: 'Beginner',
            mode: 'Recorded',
            modules: [
              {
                id: 'm1',
                title: 'Phonics Audio Exercise',
                assignmentFileName: 'Phonics Audio Exercise',
                assignmentFileUrl: '/api/files/phonics.pdf'
              }
            ]
          }
        ]
      }
    });
    scheduleApi.getSchedules.mockResolvedValue({
      success: true,
      data: []
    });
    assignmentApi.getMyTrainerSubmissions.mockResolvedValue({
      success: true,
      data: []
    });

    render(
      <MemoryRouter>
        <TrainerLearnerAssignmentsPage />
      </MemoryRouter>
    );

    // Verify Extra Assignments tab is NOT present
    expect(screen.queryByText(/Extra Assignments/i)).toBeNull();

    // Verify course dropdown and assignment card are populated
    await waitFor(() => {
      expect(screen.getAllByText('English Masterclass').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Phonics Audio Exercise').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('3. Displays assignment cards with status badge and details', async () => {
    courseApi.getMyTrainerCourses.mockResolvedValue({
      success: true,
      data: {
        enrolled: [
          {
            id: 'c1',
            title: 'Speed English',
            mode: 'Recorded',
            modules: [
              {
                id: 'm2',
                title: 'Essay Draft 1',
                assignmentFileName: 'Essay Draft 1',
                assignmentFileUrl: '/api/files/essay.pdf'
              }
            ]
          }
        ]
      }
    });
    scheduleApi.getSchedules.mockResolvedValue({ success: true, data: [] });
    assignmentApi.getMyTrainerSubmissions.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'sub_1',
          sourceId: 'm2',
          assignmentTitle: 'Essay Draft 1',
          status: 'Reviewed',
          score: 45,
          maxScore: 50,
          trainerFeedback: 'Well structured and clear expression.'
        }
      ]
    });

    render(
      <MemoryRouter>
        <AssignmentPage role="TRAINER" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Essay Draft 1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Trainer Evaluation/i)).toBeDefined();
      expect(screen.getByText(/Score:\s*45/i)).toBeDefined();
    });
  });
});
