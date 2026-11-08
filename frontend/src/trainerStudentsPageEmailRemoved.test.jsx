import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TrainerStudentsPage from './components/trainer/TrainerStudentsPage';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'trn-1', name: 'John Trainer', email: 'trainer@example.com', role: 'TRAINER' }
  })
}));

vi.mock('./api/userApi', () => ({
  getTrainerStudents: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'usr-std-1',
        name: 'Alice Student',
        email: 'alice.private@example.com',
        status: 'Active',
        courseBatches: [
          { course: 'Online English', courseId: 'crs-online-1', batch: 'Batch Morning', batchId: 'batch-1' }
        ]
      },
      {
        id: 'usr-std-2',
        name: 'Bob Recorded',
        email: 'bob.private@example.com',
        status: 'Active',
        courseBatches: [
          { course: 'Recorded English', courseId: 'crs-rec-1', batch: 'Recorded', batchId: 'b-rec' }
        ]
      }
    ]
  })
}));

vi.mock('./api/courseApi', () => ({
  getCourses: vi.fn().mockResolvedValue({
    data: [
      { id: 'crs-online-1', title: 'Online English', mode: 'Online', audience: 'student', assignedTrainer: 'John Trainer', trainerId: 'trn-1' },
      { id: 'crs-rec-1', title: 'Recorded English', mode: 'Recorded', audience: 'student', assignedTrainer: 'John Trainer', trainerId: 'trn-1' }
    ]
  }),
  getTrainerCourseRequests: vi.fn().mockResolvedValue({
    data: [
      { courseId: 'crs-online-1', status: 'Approved' },
      { courseId: 'crs-rec-1', status: 'Approved' }
    ]
  })
}));

vi.mock('./api/batchApi', () => ({
  getBatches: vi.fn().mockResolvedValue({
    data: [
      { id: 'batch-1', name: 'Batch Morning', courseId: 'crs-online-1', trainerId: 'trn-1', trainerName: 'John Trainer' }
    ]
  })
}));

describe('TrainerStudentsPage Task F13: Remove student email under name in both tabs', () => {
  it('renders student name without student email in Online & Hybrid tab', async () => {
    render(<TrainerStudentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Student')).toBeTruthy();
      expect(screen.queryByText('alice.private@example.com')).toBeNull();
    });
  });

  it('renders student name without student email in Recorded Course Students tab', async () => {
    render(<TrainerStudentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Recorded Course Students/i)).toBeTruthy();
    });

    const recordedTabBtn = screen.getByText(/Recorded Course Students/i);
    fireEvent.click(recordedTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Bob Recorded')).toBeTruthy();
      expect(screen.queryByText('bob.private@example.com')).toBeNull();
    });
  });

  it('still supports searching students by email query without rendering email in table', async () => {
    render(<TrainerStudentsPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search students/i)).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/search students/i);
    fireEvent.change(searchInput, { target: { value: 'alice.private' } });

    await waitFor(() => {
      expect(screen.getByText('Alice Student')).toBeTruthy();
      expect(screen.queryByText('alice.private@example.com')).toBeNull();
    });
  });
});
