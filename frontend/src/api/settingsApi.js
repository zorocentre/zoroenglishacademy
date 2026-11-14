import { getWebsiteSettings, saveWebsiteSettings } from './websiteSettingsApi';
import { apiResponse } from './client';

const DEFAULT_SETTINGS = {
  generalInfo: {
    academyName: '',
    tagline: '',
    contactEmail: 'contact@zoroacademy.com',
    contactPhone: '+91 98765 43210',
    address: 'No. 12, Main Road, Skill Nagar, Chennai - 600001',
    currency: 'INR (₹)'
  },
  securitySettings: {
    autoGeneratePasswords: true,
    requirePasswordChange: false,
    sessionTimeoutMins: 60,
    notifyOnNewEnrollment: true
  },
  notificationTriggers: {
    emailOnEnrollment: true,
    smsOnReminder: true,
    notifyOnDoubt: true
  }
};

export const getSettings = async () => {
  const { data: webSettings } = await getWebsiteSettings();
  const genInfo = webSettings?.generalInfo || DEFAULT_SETTINGS.generalInfo;
  return apiResponse({
    ...DEFAULT_SETTINGS,
    generalInfo: genInfo
  });
};

export const saveSettings = async (newSettingsData) => {
  const genInfo = newSettingsData.generalInfo || newSettingsData;
  const saveRes = await saveWebsiteSettings({
    generalInfo: genInfo
  });
  if (saveRes && saveRes.success) {
    return apiResponse({ generalInfo: genInfo }, true, 'Settings saved successfully');
  }
  return apiResponse(null, false, saveRes?.message || 'Failed to save settings');
};
