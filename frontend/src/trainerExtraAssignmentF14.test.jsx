import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import TrainerAssignmentsPage from './components/trainer/TrainerAssignmentsPage';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'trn-1', name: 'John Trainer', email: 'trainer@example.com', role: 'TRAINER' }
  })
}));

vi.mock('./context/DialogContext', () => ({
  useDialog: () => ({
    showError: vi.fn(),
    showWarning: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true)
  })
}));

vi.mock('./api/assignmentApi', () => ({
  getCreatedAssignments: vi.fn().mockResolvedValue({ data: [] }),
  createExtraAssignment: vi.fn().mockResolvedValue({ success: true, data: {} }),
  updateAssignment: vi.fn().mockResolvedValue({ success: true, data: {} }),
  deleteAssignment: vi.fn().mockResolvedValue({ success: true }),
  getTrainerAllocatedCourses: vi.fn().mockResolvedValue({
    success: true,
    data: [
      { id: 'crs-online-1', title: 'Spoken English Online', mode: 'Online', audience: 'student', status: 'Active' },
      { id: 'crs-hybrid-1', title: 'Business English Hybrid', mode: 'Hybrid', audience: 'student', status: 'Active' }
    ]
  }),
  getTrainerBatchesForCourse: vi.fn().mockResolvedValue({
    success: true,
    data: [
      { id: 'batch-1', name: 'Morning Batch' }
    ]
  }),
  getTrainerStudentsForCourse: vi.fn().mockResolvedValue({
    success: true,
    data: []
  })
}));

vi.mock('./api/batchApi', () => ({
  getBatches: vi.fn().mockResolvedValue({
    data: [
      { id: 'batch-1', name: 'Morning Batch', courseId: 'crs-online-1', trainerId: 'trn-1', trainerName: 'John Trainer' }
    ]
  })
}));

vi.mock('./api/userApi', () => ({
  getTrainerStudents: vi.fn().mockResolvedValue({ success: true, data: [] })
}));

describe('TrainerAssignmentsPage Task F14: Extra Assignment course dropdowns & Modal Portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('populates both course dropdowns with only eligible courses (no trainer-audience courses)', async () => {
    render(<TrainerAssignmentsPage />);

    // Filter dropdown
    await waitFor(() => {
      expect(screen.getByText('Spoken English Online')).toBeTruthy();
      expect(screen.getByText('Business English Hybrid')).toBeTruthy();
      expect(screen.queryByText(/Train the Trainer/i)).toBeNull();
    });

    // Open create assignment modal
    const createBtn = screen.getByRole('button', { name: /create extra assignment/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('Assign tasks to an entire batch, all students in a course, or specific individual students.')).toBeTruthy();
    });

    // Form course dropdown portalled into document.body
    let formCourseSelect;
    await waitFor(() => {
      formCourseSelect = within(document.body).getByLabelText(/select course/i);
      expect(formCourseSelect).toBeTruthy();
    });

    const options = Array.from(formCourseSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(options).toContain('Spoken English Online');
    expect(options).toContain('Business English Hybrid');
    expect(options).not.toContain('Train the Trainer');
  });

  it('Task G1: Select Target Students modal stacks on top of Create Assignment modal and Escape closes only child', async () => {
    render(<TrainerAssignmentsPage />);

    // Open create assignment modal
    const createBtn = screen.getByRole('button', { name: /create extra assignment/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('Assign tasks to an entire batch, all students in a course, or specific individual students.')).toBeTruthy();
    });

    // Select "Specific Student" button
    const studentBtn = within(document.body).getByText('Specific Student');
    fireEvent.click(studentBtn);

    // Click "Choose Students"
    const chooseStudentsBtn = await waitFor(() => {
      const btn = within(document.body).getByRole('button', { name: /choose students/i });
      expect(btn).toBeTruthy();
      return btn;
    });
    fireEvent.click(chooseStudentsBtn);

    // Target Students modal should now be open
    await waitFor(() => {
      expect(within(document.body).getByText('Select Target Students')).toBeTruthy();
    });

    // Verify portals and stacking:
    const portalRoots = document.querySelectorAll('[data-modal-portal-root="true"]');
    expect(portalRoots.length).toBeGreaterThanOrEqual(2);

    const layer0Backdrop = document.querySelector('[data-modal-layer="0"]');
    const layer1Backdrop = document.querySelector('[data-modal-layer="1"]');
    expect(layer0Backdrop).toBeTruthy();
    expect(layer1Backdrop).toBeTruthy();
    expect(layer0Backdrop.style.zIndex).toBe('10000');
    expect(layer1Backdrop.style.zIndex).toBe('10010');

    // Pressing Escape should close ONLY the child (Select Target Students)
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(within(document.body).queryByText('Select Target Students')).toBeNull();
      // Parent modal must remain open and interactive
      expect(within(document.body).getByText('Assign tasks to an entire batch, all students in a course, or specific individual students.')).toBeTruthy();
    });
  });
});
