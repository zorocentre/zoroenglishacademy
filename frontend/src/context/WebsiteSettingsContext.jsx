import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getWebsiteSettings, DEFAULT_WEBSITE_SETTINGS } from '../api/websiteSettingsApi';

const WebsiteSettingsContext = createContext(null);

export function WebsiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_WEBSITE_SETTINGS);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const reloadSettings = useCallback(async () => {
    try {
      const res = await getWebsiteSettings();
      if (res && res.data) {
        setSettings(res.data);
        setIsOfflineFallback(Boolean(res.isOfflineFallback));
        setOfflineMessage(res.offlineMessage || '');
      }
    } catch {
      setIsOfflineFallback(true);
      setOfflineMessage('Using default content (server unreachable)');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const academyName = settings?.landingPageContent?.academyName || settings?.generalInfo?.academyName || 'Zoro English Academy';
  const tagline = settings?.landingPageContent?.tagline || settings?.generalInfo?.tagline || 'Small Steps Big Communication';
  const contactEmail = settings?.contactPageContent?.contactEmail || settings?.generalInfo?.contactEmail || 'contact@zoroacademy.com';
  const contactPhone = settings?.contactPageContent?.contactPhone || settings?.generalInfo?.contactPhone || '+91 98765 43210';
  const address = settings?.contactPageContent?.contactAddress || settings?.generalInfo?.address || 'No. 12, Main Road, Skill Nagar, Chennai - 600001';
  const currency = settings?.generalInfo?.currency || 'INR (₹)';

  useEffect(() => {
    if (academyName) {
      document.title = tagline ? `${academyName} - ${tagline}` : academyName;
    }
  }, [academyName, tagline]);

  const updateLocalSettings = useCallback((updated) => {
    setSettings(prev => ({
      ...prev,
      ...updated,
      generalInfo: {
        ...prev.generalInfo,
        ...(updated.generalInfo || {})
      },
      landingPageContent: {
        ...prev.landingPageContent,
        ...(updated.landingPageContent || {})
      },
      aboutPageContent: {
        ...prev.aboutPageContent,
        ...(updated.aboutPageContent || {})
      },
      contactPageContent: {
        ...prev.contactPageContent,
        ...(updated.contactPageContent || {})
      }
    }));
  }, []);

  return (
    <WebsiteSettingsContext.Provider
      value={{
        settings,
        academyName,
        tagline,
        contactEmail,
        contactPhone,
        address,
        currency,
        isOfflineFallback,
        offlineMessage,
        loading,
        reloadSettings,
        updateLocalSettings
      }}
    >
      {children}
    </WebsiteSettingsContext.Provider>
  );
}

export function useWebsiteSettings() {
  const ctx = useContext(WebsiteSettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_WEBSITE_SETTINGS,
      academyName: DEFAULT_WEBSITE_SETTINGS.generalInfo.academyName,
      tagline: DEFAULT_WEBSITE_SETTINGS.generalInfo.tagline,
      contactEmail: DEFAULT_WEBSITE_SETTINGS.generalInfo.contactEmail,
      contactPhone: DEFAULT_WEBSITE_SETTINGS.generalInfo.contactPhone,
      address: DEFAULT_WEBSITE_SETTINGS.generalInfo.address,
      currency: DEFAULT_WEBSITE_SETTINGS.generalInfo.currency,
      isOfflineFallback: false,
      offlineMessage: '',
      loading: false,
      reloadSettings: async () => {},
      updateLocalSettings: () => {}
    };
  }
  return ctx;
}
