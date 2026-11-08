import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TrainerDashboard from './components/trainer/TrainerDashboard';
import * as scheduleApi from './api/scheduleApi';

// Mock contexts and APIs
vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'trn-1', name: 'John Trainer', role: 'TRAINER' }
  })
}));

vi.mock('./api/scheduleApi', () => ({
  getTrainerSchedules: vi.fn()
}));

vi.mock('./api/attendanceApi', () => ({
  getAttendanceRecords: vi.fn().mockResolvedValue({ data: [] })
}));

vi.mock('./api/userApi', () => ({
  getTrainerDashboardStats: vi.fn().mockResolvedValue({
    success: true,
    data: {
      todaySessions: 1,
      myStudents: 15,
      batchCount: 2,
      pendingCorrections: 3,
      doubtsToAnswer: 1,
      conductedClasses: 10,
      totalClasses: 12,
      correctedAssignments: 8,
      totalAssignments: 10,
      attendanceRate: 90,
      performancePercent: 83
    }
  })
}));

describe('TrainerDashboard Task F12: Today Schedule & Student Satisfaction Placeholder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Coming soon" placeholder for Student Satisfaction without 4.9 score', async () => {
    scheduleApi.getTrainerSchedules.mockResolvedValue({ data: [] });

    render(<TrainerDashboard setActiveScreen={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Student Satisfaction')).toBeTruthy();
      expect(screen.getByText('Coming soon')).toBeTruthy();
      expect(screen.queryByText(/4\.9/)).toBeNull();
      expect(screen.queryByText(/\/ 5\.0/)).toBeNull();
    });
  });

  it('shows empty state "No sessions scheduled for today." when no active sessions today', async () => {
    scheduleApi.getTrainerSchedules.mockResolvedValue({ data: [] });

    render(<TrainerDashboard setActiveScreen={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No sessions scheduled for today.')).toBeTruthy();
    });
  });
});
