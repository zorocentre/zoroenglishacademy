import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HeroCarousel from './components/public/HeroCarousel';
import PublicNavbar from './components/layout/PublicNavbar';
import { WebsiteSettingsProvider } from './context/WebsiteSettingsContext';
import { resolveFileUrl } from './api/fileApi';

describe('Task J: Hero Carousel, CDN Link & Dynamic Navbar Tagline Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('J1.1: HeroCarousel resolves image URLs using resolveFileUrl for single cover image', () => {
    const images = [
      {
        id: 'hero_1',
        url: '/api/files/hero-123.jpg',
        altText: 'Custom Hero Image',
        active: true,
        sortOrder: 0
      }
    ];

    render(
      <HeroCarousel images={images}>
        <h1>Welcome</h1>
      </HeroCarousel>
    );

    const img = screen.getByAltText('Custom Hero Image');
    expect(img).toBeDefined();
    // Must be resolved to absolute URL via resolveFileUrl, not raw relative /api/files/...
    expect(img.getAttribute('src')).toBe(resolveFileUrl('/api/files/hero-123.jpg'));
  });

  it('J1.2: HeroCarousel resolves image URLs using resolveFileUrl for carousel slides (>1 images)', () => {
    const images = [
      {
        id: 'hero_1',
        url: '/api/files/slide1.jpg',
        altText: 'Slide 1',
        active: true,
        sortOrder: 0
      },
      {
        id: 'hero_2',
        url: '/api/files/slide2.jpg',
        altText: 'Slide 2',
        active: true,
        sortOrder: 1
      }
    ];

    render(
      <HeroCarousel images={images}>
        <h1>Welcome Multi</h1>
      </HeroCarousel>
    );

    const img1 = screen.getByAltText('Slide 1');
    const img2 = screen.getByAltText('Slide 2');
    expect(img1.getAttribute('src')).toBe(resolveFileUrl('/api/files/slide1.jpg'));
    expect(img2.getAttribute('src')).toBe(resolveFileUrl('/api/files/slide2.jpg'));
  });

  it('J1.3: HeroCarousel renders neutral placeholder gradient when images list is empty', () => {
    render(
      <HeroCarousel images={[]}>
        <h1>Hero Content</h1>
      </HeroCarousel>
    );

    expect(screen.getByText('Hero Content')).toBeDefined();
    expect(document.querySelector('img')).toBeNull();
  });

  it('J2: resolveFileUrl turns host-free relative paths into full API URLs', () => {
    const relativePath = '/api/files/3bb73574-6e34-4a2d-8105-48ebdbe19719';
    const resolved = resolveFileUrl(relativePath);
    expect(resolved).not.toBe(relativePath);
    expect(resolved).toMatch(/^https?:\/\//);
    expect(resolved).toContain('3bb73574-6e34-4a2d-8105-48ebdbe19719');
  });

  it('J3.1: PublicNavbar renders neutral placeholder while settings are loading and does not flash hard-coded text', () => {
    // Mock getWebsiteSettings to return a never-resolving promise to inspect initial paint
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})));

    render(
      <WebsiteSettingsProvider>
        <PublicNavbar activeScreen="public-home" setActiveScreen={vi.fn()} onOpenLogin={vi.fn()} onOpenEnquire={vi.fn()} />
      </WebsiteSettingsProvider>
    );

    // Initial paint: placeholder skeleton must be rendered
    const placeholder = screen.getByTestId('logo-text-placeholder');
    expect(placeholder).toBeDefined();

    // Must NOT contain hard-coded marketing copy
    expect(screen.queryByText(/Small Steps Big Communication/i)).toBeNull();
    expect(screen.queryByText(/SMALL STEPS BIG COMMUNICATION/i)).toBeNull();
  });

  it('J3.2: PublicNavbar renders real tagline after settings resolve', async () => {
    const mockSettings = {
      success: true,
      data: {
        id: 'default',
        settingsJson: {
          landingPageContent: {
            academyName: 'Zoro Academy Dynamic',
            tagline: 'Custom Academy Tagline'
          },
          generalInfo: {
            academyName: 'Zoro Academy Dynamic',
            tagline: 'Custom Academy Tagline'
          }
        }
      }
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => mockSettings,
      text: async () => JSON.stringify(mockSettings)
    })));

    render(
      <WebsiteSettingsProvider>
        <PublicNavbar activeScreen="public-home" setActiveScreen={vi.fn()} onOpenLogin={vi.fn()} onOpenEnquire={vi.fn()} />
      </WebsiteSettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('logo-tagline').textContent).toBe('Custom Academy Tagline');
      expect(screen.getByTestId('logo-academy-name').textContent).toBe('Zoro Academy Dynamic');
    });

    expect(screen.queryByTestId('logo-text-placeholder')).toBeNull();
  });

  it('J3.3: PublicNavbar renders empty tagline on failed request without falling back to hard-coded copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ message: 'Failed to fetch' })
    })));

    render(
      <WebsiteSettingsProvider>
        <PublicNavbar activeScreen="public-home" setActiveScreen={vi.fn()} onOpenLogin={vi.fn()} onOpenEnquire={vi.fn()} />
      </WebsiteSettingsProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('logo-text-placeholder')).toBeNull();
    });

    // Tagline element should not exist and hard-coded string must not appear
    expect(screen.queryByTestId('logo-tagline')).toBeNull();
    expect(screen.queryByText(/Small Steps Big Communication/i)).toBeNull();
  });
});
