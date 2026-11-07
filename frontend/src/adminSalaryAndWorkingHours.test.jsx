import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminSalaryPage from './components/admin/AdminSalaryPage';
import AdminOnlineSessionHistoryPage from './components/admin/AdminOnlineSessionHistoryPage';
import ManageTrainersPage from './components/admin/ManageTrainersPage';
import { DialogProvider } from './context/DialogContext';

// Mocks
vi.mock('./api/salaryApi', () => ({
  getSalaryPayments: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'sal_001',
        trainerId: 'trn_1',
        trainerName: 'Jane Trainer',
        month: '2026-10-01 to 2026-10-31',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
        onlineSessionSalary: 12000,
        recordedSessionSalary: 3000,
        totalSalary: 15000,
        amount: 15000,
        paymentDate: '2026-11-02',
        paymentMethod: 'Bank Transfer',
        transactionId: 'TXN998877',
        sessionCount: 8,
        creditedHours: 12.0,
        notes: 'October salary'
      }
    ]
  }),
  createSalaryPayment: vi.fn().mockResolvedValue({ success: true, data: { id: 'sal_002' } }),
  deleteSalaryPayment: vi.fn().mockResolvedValue({ success: true }),
  getPaymentSessions: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'sch_1',
        course: 'Spoken English Mastery',
        batch: 'Batch Alpha',
        date: '2026-10-15',
        time: '10:00 AM - 11:30 AM',
        creditedDurationMinutes: 90
      }
    ]
  })
}));

vi.mock('./api/scheduleApi', () => ({
  getOnlineSessionHistory: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'sch_hist_1',
        title: 'Grammar Masterclass',
        course: 'English Pro',
        batch: 'Alpha Batch',
        trainer: 'Jane Trainer',
        trainerId: 'trn_1',
        date: '2026-10-20',
        time: '04:00 PM - 05:00 PM',
        trainerJoined: true,
        creditedDurationMinutes: 60
      },
      {
        id: 'sch_hist_2',
        title: 'Vocabulary Session',
        course: 'English Pro',
        batch: 'Beta Batch',
        trainer: 'John Trainer',
        trainerId: 'trn_2',
        date: '2026-10-21',
        time: '06:00 PM - 07:00 PM',
        trainerJoined: false,
        creditedDurationMinutes: 0
      }
    ]
  }),
  getUnpaidCreditedSessions: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'sch_unpaid_1',
        course: 'English Pro',
        batch: 'Alpha Batch',
        date: '2026-10-25',
        time: '10:00 AM - 11:30 AM',
        creditedDurationMinutes: 90
      }
    ]
  })
}));

vi.mock('./api/userApi', () => ({
  getTrainers: vi.fn().mockResolvedValue({
    success: true,
    data: [
      { id: 'trn_1', name: 'Jane Trainer', email: 'jane@zoro.com', specialty: 'English' },
      { id: 'trn_2', name: 'John Trainer', email: 'john@zoro.com', specialty: 'IELTS' }
    ]
  }),
  revealPassword: vi.fn().mockResolvedValue({ success: true, data: { plainPassword: 'SecretPassword123' } })
}));

describe('Trainer Working Hours & Salary Management System', () => {
  it('AdminSalaryPage renders with Add Salary button, totals, and payment history', async () => {
    render(
      <DialogProvider>
        <AdminSalaryPage />
      </DialogProvider>
    );

    expect(await screen.findByText('Trainer Salary')).toBeDefined();
    expect(screen.getByText('Add Salary')).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('Jane Trainer').length).toBeGreaterThan(0);
      expect(screen.getAllByText('₹15,000').length).toBeGreaterThan(0);
      expect(screen.getAllByText('₹12,000').length).toBeGreaterThan(0);
      expect(screen.getAllByText('₹3,000').length).toBeGreaterThan(0);
    });
  });

  it('Add Salary modal automatically calculates Total Salary = Online + Recorded', async () => {
    render(
      <DialogProvider>
        <AdminSalaryPage />
      </DialogProvider>
    );

    const addBtn = await screen.findByRole('button', { name: /Add Salary/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Record Trainer Salary Payment')).toBeDefined();
    });

    const onlineInput = screen.getByPlaceholderText('e.g. 15000');
    const recordedInput = screen.getByPlaceholderText('e.g. 5000');

    fireEvent.change(onlineInput, { target: { value: '8000' } });
    fireEvent.change(recordedInput, { target: { value: '2000' } });

    await waitFor(() => {
      expect(screen.getAllByText('₹10,000').length).toBeGreaterThan(0);
    });
  });

  it('AdminOnlineSessionHistoryPage renders primary columns without student names', async () => {
    render(
      <DialogProvider>
        <AdminOnlineSessionHistoryPage />
      </DialogProvider>
    );

    expect(await screen.findByText('Online Session History')).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('English Pro').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Jane Trainer').length).toBeGreaterThan(0);
      expect(screen.getByText('1h (Joined)')).toBeDefined();
      expect(screen.getByText('0m (Not Joined)')).toBeDefined();
    });

    // Ensure student names do not appear in the table header or content
    expect(screen.queryByText(/Student Name/i)).toBeNull();
  });

  it('ManageTrainersPage does NOT render Monthly Salary or Salary Credit Date', async () => {
    render(
      <DialogProvider>
        <ManageTrainersPage />
      </DialogProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Trainer Management')).toBeDefined();
    });

    // Verify Monthly Salary and Salary Credit Date are removed
    expect(screen.queryByText('Monthly Salary')).toBeNull();
    expect(screen.queryByText('Salary Credit Date')).toBeNull();
    expect(screen.queryByText('Monthly Salary (₹)')).toBeNull();
  });
});
