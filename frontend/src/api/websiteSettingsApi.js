import { apiGet, apiPost, apiPut, apiDelete, apiResponse } from './client';

export const DEFAULT_WEBSITE_SETTINGS = {
  landingPageContent: {
    academyName: 'Zoro English Academy',
    tagline: 'Small Steps Big Communication',
    heroBadge: '',
    heroHeading: '',
    heroDescription: '',
    heroPrimaryBtnText: 'Explore Courses',
    heroSecondaryBtnText: 'Join a Competition',
    featuresTitle: 'Featured Learning Programs',
    featuresSubtitle: '',
    spotlightTitle: 'National Championship & Competitions Spotlight',
    spotlightSubtitle: ''
  },
  aboutPageContent: {
    heading: 'About Us',
    subtitle: '',
    introParagraph: '',
    missionStatement: '',
    visionStatement: '',
    coreValues: ''
  },
  contactPageContent: {
    heading: 'Contact Us',
    subtitle: '',
    contactPhone: '',
    contactEmail: '',
    contactAddress: '',
    businessHours: '',
    googleMapLink: ''
  },
  generalInfo: {
    academyName: 'Zoro English Academy',
    tagline: 'Small Steps Big Communication',
    contactEmail: '',
    contactPhone: '',
    address: '',
    currency: 'INR (₹)'
  }
};

export const getWebsiteSettings = async () => {
  const res = await apiGet('/website-settings');
  if (res && res.success && res.data) {
    let parsedJson = null;
    if (res.data.settingsJson) {
      try {
        parsedJson = typeof res.data.settingsJson === 'string'
          ? JSON.parse(res.data.settingsJson)
          : res.data.settingsJson;
      } catch (e) {}
    }

    const contactEmail = res.data.contactEmail || parsedJson?.contactPageContent?.contactEmail || parsedJson?.generalInfo?.contactEmail || DEFAULT_WEBSITE_SETTINGS.contactPageContent.contactEmail;
    const contactPhone = res.data.contactPhone || parsedJson?.contactPageContent?.contactPhone || parsedJson?.generalInfo?.contactPhone || DEFAULT_WEBSITE_SETTINGS.contactPageContent.contactPhone;
    const contactAddress = res.data.address || parsedJson?.contactPageContent?.contactAddress || parsedJson?.generalInfo?.address || DEFAULT_WEBSITE_SETTINGS.contactPageContent.contactAddress;

    const merged = {
      ...DEFAULT_WEBSITE_SETTINGS,
      ...(parsedJson || {}),
      landingPageContent: {
        ...DEFAULT_WEBSITE_SETTINGS.landingPageContent,
        heroHeading: res.data.heroHeadline || parsedJson?.landingPageContent?.heroHeading || DEFAULT_WEBSITE_SETTINGS.landingPageContent.heroHeading,
        heroDescription: res.data.heroSubheadline || parsedJson?.landingPageContent?.heroDescription || DEFAULT_WEBSITE_SETTINGS.landingPageContent.heroDescription,
        ...(parsedJson?.landingPageContent || {})
      },
      aboutPageContent: {
        ...DEFAULT_WEBSITE_SETTINGS.aboutPageContent,
        ...(parsedJson?.aboutPageContent || {})
      },
      contactPageContent: {
        ...DEFAULT_WEBSITE_SETTINGS.contactPageContent,
        contactEmail,
        contactPhone,
        contactAddress,
        ...(parsedJson?.contactPageContent || {})
      },
      generalInfo: {
        ...DEFAULT_WEBSITE_SETTINGS.generalInfo,
        contactEmail,
        contactPhone,
        address: contactAddress,
        ...(parsedJson?.generalInfo || parsedJson?.adminSettings?.generalInfo || {})
      }
    };
    delete merged.portalControls;
    const baseRes = await apiResponse(merged);
    return { ...baseRes, isOfflineFallback: false };
  }
  const fallbackRes = await apiResponse(DEFAULT_WEBSITE_SETTINGS, true);
  return { ...fallbackRes, isOfflineFallback: true, offlineMessage: 'Using default content (server unreachable)' };
};

export const saveWebsiteSettings = async (newSettingsData) => {
  const { data: current } = await getWebsiteSettings();
  const updated = {
    ...current,
    ...newSettingsData
  };
  delete updated.portalControls;

  const contactEmail = newSettingsData.contactPageContent?.contactEmail
    || newSettingsData.generalInfo?.contactEmail
    || updated.contactPageContent?.contactEmail
    || updated.generalInfo?.contactEmail;

  const contactPhone = newSettingsData.contactPageContent?.contactPhone
    || newSettingsData.generalInfo?.contactPhone
    || updated.contactPageContent?.contactPhone
    || updated.generalInfo?.contactPhone;

  const address = newSettingsData.contactPageContent?.contactAddress
    || newSettingsData.generalInfo?.address
    || updated.contactPageContent?.contactAddress
    || updated.generalInfo?.address;

  if (updated.contactPageContent) {
    updated.contactPageContent.contactEmail = contactEmail;
    updated.contactPageContent.contactPhone = contactPhone;
    updated.contactPageContent.contactAddress = address;
  }
  if (updated.generalInfo) {
    updated.generalInfo.contactEmail = contactEmail;
    updated.generalInfo.contactPhone = contactPhone;
    updated.generalInfo.address = address;
  }

  const payload = {
    heroHeadline: updated.landingPageContent?.heroHeading,
    heroSubheadline: updated.landingPageContent?.heroDescription,
    contactEmail,
    contactPhone,
    address,
    settingsJson: JSON.stringify(updated)
  };

  const res = await apiPut('/website-settings', payload);
  if (res && res.success) {
    return apiResponse(updated, true, 'Settings saved successfully');
  }
  return apiResponse(null, false, res?.message || 'Failed to save website settings');
};

/**
 * Public: Get active hero images ordered by sort order
 */
export const getHeroImages = async () => {
  const res = await apiGet('/website-settings/hero-images');
  return res;
};

/**
 * Admin: Get all hero images (active & inactive)
 */
export const getAllHeroImages = async () => {
  const res = await apiGet('/admin/website-settings/hero-images');
  return res;
};

/**
 * Admin: Create a new hero image
 */
export const createHeroImage = async (data) => {
  const res = await apiPost('/admin/website-settings/hero-images', data);
  return res;
};

/**
 * Admin: Update sort orders for hero images
 * @param {Array<{ id: string, sortOrder: number }>} orders
 */
export const updateHeroImageOrder = async (orders) => {
  const res = await apiPut('/admin/website-settings/hero-images/order', orders);
  return res;
};

/**
 * Admin: Update a single hero image
 */
export const updateHeroImage = async (id, data) => {
  const res = await apiPut(`/admin/website-settings/hero-images/${encodeURIComponent(id)}`, data);
  return res;
};

/**
 * Admin: Delete hero image and purge storage
 */
export const deleteHeroImage = async (id) => {
  const res = await apiDelete(`/admin/website-settings/hero-images/${encodeURIComponent(id)}`);
  return res;
};

