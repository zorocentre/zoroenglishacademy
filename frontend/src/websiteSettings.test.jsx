import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WebsiteSettingsProvider, useWebsiteSettings } from './context/WebsiteSettingsContext';
import { DialogProvider } from './context/DialogContext';
import AdminSettingsPage from './components/admin/AdminSettingsPage';
import ContactPage from './components/public/ContactPage';
import HomePage from './components/public/HomePage';
import realWebsiteSettingsFixture from './test/fixtures/real-website-settings.json';

// Test consumer helper to inspect context values
function SettingsInspector() {
  const { settings, isOfflineFallback, offlineMessage, academyName, tagline } = useWebsiteSettings();
  return (
    <div>
      <span data-testid="academy-name">{academyName}</span>
      <span data-testid="tagline">{tagline}</span>
      <span data-testid="offline-fallback">{String(isOfflineFallback)}</span>
      <span data-testid="offline-msg">{offlineMessage}</span>
      <span data-testid="spotlight-title">{settings?.landingPageContent?.spotlightTitle}</span>
      <span data-testid="map-link">{settings?.contactPageContent?.googleMapLink}</span>
    </div>
  );
}

describe('Task 4: WebsiteSettings Context, Dynamic Rendering, Offline Fallback & Admin Dialog', () => {
  let consoleErrors = [];
  let originalConsoleError;

  beforeEach(() => {
    consoleErrors = [];
    originalConsoleError = console.error;
    console.error = (...args) => {
      const msg = args.map(a => (a instanceof Error ? a.stack || a.message : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      consoleErrors.push(msg);
      originalConsoleError(...args);
    };
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it('1. Loads database settings and updates document.title correctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/website-settings')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => realWebsiteSettingsFixture,
          text: async () => JSON.stringify(realWebsiteSettingsFixture)
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }));

    render(
      <WebsiteSettingsProvider>
        <SettingsInspector />
      </WebsiteSettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('academy-name').textContent).toBe('Zoro English Academy');
    });

    expect(screen.getByTestId('tagline').textContent).toBe('Small Steps Big Communication');
    expect(screen.getByTestId('offline-fallback').textContent).toBe('false');
    expect(screen.getByTestId('spotlight-title').textContent).toBe('National Championship & Competitions Spotlight');
    expect(screen.getByTestId('map-link').textContent).toBe('https://maps.google.com');
    expect(document.title).toBe('Zoro English Academy - Small Steps Big Communication');
  });

  it('2. Gracefully falls back to default settings with offline notice when server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/website-settings')) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ success: false, message: 'Server unreachable' }),
          text: async () => JSON.stringify({ success: false, message: 'Server unreachable' })
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }));

    render(
      <WebsiteSettingsProvider>
        <SettingsInspector />
      </WebsiteSettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('offline-fallback').textContent).toBe('true');
    });

    expect(screen.getByTestId('offline-msg').textContent).toContain('Using default content (server unreachable)');
    expect(screen.getByTestId('academy-name').textContent).toBe('Zoro English Academy');
  });

  it('3. AdminSettingsPage renders editable fields from DB and shows offline warning if fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/website-settings')) {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ success: false }),
          text: async () => JSON.stringify({ success: false })
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }));

    render(
      <MemoryRouter>
        <DialogProvider>
          <WebsiteSettingsProvider>
            <AdminSettingsPage />
          </WebsiteSettingsProvider>
        </DialogProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Using default content \(server unreachable\)/i)).toBeDefined();
    });
  });

  it('4. AdminSettingsPage save workflow calls PUT and triggers success dialog', async () => {
    let putPayload = null;

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input, options = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = (options.method || 'GET').toUpperCase();

      if (url.includes('/website-settings')) {
        if (method === 'GET') {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => realWebsiteSettingsFixture,
            text: async () => JSON.stringify(realWebsiteSettingsFixture)
          };
        }
        if (method === 'PUT') {
          putPayload = JSON.parse(options.body);
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({
              success: true,
              data: {
                ...realWebsiteSettingsFixture.data,
                settingsJson: putPayload
              },
              message: 'Settings updated successfully'
            }),
            text: async () => JSON.stringify({ success: true, message: 'Settings updated successfully' })
          };
        }
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }));

    render(
      <MemoryRouter>
        <DialogProvider>
          <WebsiteSettingsProvider>
            <AdminSettingsPage />
          </WebsiteSettingsProvider>
        </DialogProvider>
      </MemoryRouter>
    );

    // Wait for form to load with fixture in default Landing tab
    await waitFor(() => {
      expect(screen.getByDisplayValue('Master English with Zoro Academy')).toBeDefined();
    });

    // Offline banner should NOT be present
    expect(screen.queryByText(/Offline Mode: Server Unreachable/i)).toBeNull();

    // Academy Name is directly managed in Landing Page Content tab (Section 8)
    await waitFor(() => {
      expect(screen.getByDisplayValue('Zoro English Academy')).toBeDefined();
    });

    // Change Academy Name
    const nameInput = screen.getByDisplayValue('Zoro English Academy');
    fireEvent.change(nameInput, { target: { value: 'Zoro Global Academy' } });

    // Click Save and Publish
    const saveButton = screen.getByRole('button', { name: /Save and Publish/i });
    fireEvent.click(saveButton);

    // Verify Success Dialog appears
    await waitFor(() => {
      expect(screen.getByText('Settings Published')).toBeDefined();
      expect(screen.getByText('Settings saved and published successfully')).toBeDefined();
    });

    // Check payload sent to API
    expect(putPayload).toBeTruthy();
    const saved = JSON.parse(putPayload.settingsJson);
    expect(saved.generalInfo.academyName).toBe('Zoro Global Academy');
    expect(saved.landingPageContent.academyName).toBe('Zoro Global Academy');
  });

  it('5. ContactPage dynamically links googleMapLink as "Get directions"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/website-settings')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => realWebsiteSettingsFixture,
          text: async () => JSON.stringify(realWebsiteSettingsFixture)
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }));

    render(
      <MemoryRouter>
        <WebsiteSettingsProvider>
          <ContactPage />
        </WebsiteSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const directionsLink = screen.getByRole('link', { name: /Get directions/i });
      expect(directionsLink).toBeDefined();
      expect(directionsLink.getAttribute('href')).toBe('https://maps.google.com');
      expect(directionsLink.getAttribute('target')).toBe('_blank');
    });
  });

  it('6. HomePage renders dynamic hero and spotlight titles from settings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/website-settings')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => realWebsiteSettingsFixture,
          text: async () => JSON.stringify(realWebsiteSettingsFixture)
        };
      }
      if (url.includes('/courses')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ success: true, data: [] })
        };
      }
      if (url.includes('/competitions')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({
            success: true,
            data: [{
              id: 'comp-1',
              title: 'National Spelling Bee',
              category: 'Academic',
              status: 'Active',
              startDate: '2026-11-01',
              registrationFee: 0
            }]
          })
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }));

    render(
      <MemoryRouter>
        <WebsiteSettingsProvider>
          <HomePage setActiveScreen={vi.fn()} />
        </WebsiteSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Master English with Zoro Academy')).toBeDefined();
      expect(screen.getByText('National Championship & Competitions Spotlight')).toBeDefined();
      expect(screen.getByText('Global Communication Skills')).toBeDefined();
    });
  });
});
