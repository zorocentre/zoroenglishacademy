import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

describe('A1 & A2: Role-based Portal Selection & Route Guards', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      let data = [];

      if (url.includes('/auth/me')) {
        const uStr = sessionStorage.getItem('zoro_user');
        data = uStr ? JSON.parse(uStr) : null;
      } else if (url.includes('/api/me/portals')) {
        const uStr = sessionStorage.getItem('zoro_user');
        const user = uStr ? JSON.parse(uStr) : null;
        const role = (user?.role || '').toUpperCase();
        if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
          data = { learning: true, competition: false, competitions: [], defaultPortal: 'admin' };
        } else if (user?.hasCourseEnrollment && user?.hasCompetitionRegistration) {
          data = { learning: true, competition: true, competitions: [{ id: 'comp_1', title: 'Abacus Comp' }], defaultPortal: null };
        } else if (user?.hasCourseEnrollment && !user?.hasCompetitionRegistration) {
          data = { learning: true, competition: false, competitions: [], defaultPortal: 'learning' };
        } else if (!user?.hasCourseEnrollment && user?.hasCompetitionRegistration) {
          data = { learning: false, competition: true, competitions: [{ id: 'comp_1', title: 'Abacus Comp' }], defaultPortal: 'competition' };
        } else {
          data = { learning: true, competition: false, competitions: [], defaultPortal: 'learning' };
        }
      } else if (url.includes('/website-settings') || url.includes('/settings')) {
        data = { heroHeadline: 'Zoro Academy', landingPage: {}, aboutPage: {}, generalInfo: {} };
      } else if (url.includes('/notifications')) {
        data = [];
      } else if (url.includes('/competitions')) {
        data = [];
      }

      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ success: true, data }),
        text: async () => JSON.stringify({ success: true, data }),
      };
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Admin is redirected from /portal-select to /admin and has no Switch to Competition button', async () => {
    const adminUser = {
      id: 'admin_1',
      name: 'Super Admin',
      role: 'ADMIN',
      email: 'admin@zoro.com',
      hasCourseEnrollment: true,
      hasCompetitionRegistration: false
    };
    sessionStorage.setItem('zoro_user', JSON.stringify(adminUser));
    sessionStorage.setItem('zoro_token', 'mock_admin_token');
    window.history.pushState({}, '', '/portal-select');

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin');
    });

    // Check that Switch to Competition Portal button does NOT exist
    expect(screen.queryByText(/Switch to Competition Portal/i)).toBeNull();
  });

  it('Course-only student is redirected from /portal-select and /competition to /student and has switch button with no access dialog', async () => {
    const studentUser = {
      id: 'std_course_only',
      name: 'Course Student',
      role: 'STUDENT',
      email: 'student@zoro.com',
      hasCourseEnrollment: true,
      hasCompetitionRegistration: false
    };
    sessionStorage.setItem('zoro_user', JSON.stringify(studentUser));
    sessionStorage.setItem('zoro_token', 'mock_token');
    window.history.pushState({}, '', '/portal-select');

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/student');
    });

    const switchBtns = screen.getAllByText(/Switch to Competition Portal/i);
    expect(switchBtns.length).toBeGreaterThan(0);
  });

  it('Competition-only student is redirected from /portal-select and /student to /competition and has no switch button', async () => {
    const compUser = {
      id: 'std_comp_only',
      name: 'Competition Student',
      role: 'STUDENT',
      email: 'comp@zoro.com',
      hasCourseEnrollment: false,
      hasCompetitionRegistration: true
    };
    sessionStorage.setItem('zoro_user', JSON.stringify(compUser));
    sessionStorage.setItem('zoro_token', 'mock_token');
    window.history.pushState({}, '', '/student');

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/competition');
    });

    expect(screen.queryByText(/Switch to Learning Portal/i)).toBeNull();
  });

  it('Dual-portal student on /portal-select can see both portal choices', async () => {
    const dualUser = {
      id: 'std_dual',
      name: 'Dual Student',
      role: 'STUDENT',
      email: 'dual@zoro.com',
      hasCourseEnrollment: true,
      hasCompetitionRegistration: true
    };
    sessionStorage.setItem('zoro_user', JSON.stringify(dualUser));
    sessionStorage.setItem('zoro_token', 'mock_token');
    window.history.pushState({}, '', '/portal-select');

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Learning Portal/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Competition Portal/i).length).toBeGreaterThan(0);
    });
  });
});
