import { apiGet, apiPost, apiPut, apiDelete, apiResponse, getAuthToken, API_BASE_URL } from './client';
import { logActivity } from './activityLogApi';

export const getCompetitions = async () => {
  const res = await apiGet('/competitions');
  if (res && res.success && Array.isArray(res.data)) {
    const normalized = res.data.map(c => ({
      ...c,
      id: c.id,
      title: c.title || 'Competition',
      name: c.title || 'Competition',
      category: c.category || 'Academic',
      description: c.description || '',
      startDate: c.startDate || '',
      endDate: c.endDate || '',
      regStartDate: c.regStartDate || '',
      regEndDate: c.regEndDate || '',
      startTime: c.startTime || '',
      endTime: c.endTime || '',
      venue: c.venue || '',
      bannerUrl: c.bannerUrl || '',
      rulesPdfUrl: c.rulesPdfUrl || '',
      instructions: c.instructions || '',
      rules: c.rules || '',
      contactDetails: c.contactDetails || '',
      registrationFee: parseFloat(c.registrationFee || 0),
      status: c.status || 'Active',
      modules: c.modules || [],
      registrations: c.registrations || [],
      finalUnlockAt: c.finalUnlockAt || c.final_unlock_at || null,
      startAt: c.startAt || null,
      endAt: c.endAt || null,
      regStartAt: c.regStartAt || null,
      regEndAt: c.regEndAt || null,
      leaderboardPublishTime: c.leaderboardPublishTime || null,
      leaderboardStatus: c.leaderboardStatus || 'NOT_PUBLISHED',
      leaderboardPublishedAt: c.leaderboardPublishedAt || null,
      answerReviewEnabled: Boolean(c.answerReviewEnabled)
    }));
    return apiResponse(normalized);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch competitions');
};

export const createCompetition = async (newCompData) => {
  if (!newCompData?.title && !newCompData?.name) {
    return apiResponse(null, false, 'Competition title is required');
  }
  const payload = {
    title: (newCompData.title || newCompData.name || '').trim(),
    category: newCompData.category || 'Academic',
    description: newCompData.description || '',
    startDate: newCompData.startDate || '',
    endDate: newCompData.endDate || '',
    regStartDate: newCompData.regStartDate || '',
    regEndDate: newCompData.regEndDate || '',
    startTime: newCompData.startTime || '',
    endTime: newCompData.endTime || '',
    venue: newCompData.venue || '',
    bannerUrl: newCompData.bannerUrl || '',
    rulesPdfUrl: newCompData.rulesPdfUrl || '',
    instructions: newCompData.instructions || '',
    rules: newCompData.rules || '',
    contactDetails: newCompData.contactDetails || '',
    registrationFee: parseFloat(newCompData.registrationFee || 0),
    status: newCompData.status || 'Active',
    regStartAt: newCompData.regStartAt || null,
    regEndAt: newCompData.regEndAt || null,
    startAt: newCompData.startAt || null,
    endAt: newCompData.endAt || null,
    finalUnlockAt: newCompData.finalUnlockAt || null,
    leaderboardPublishTime: newCompData.leaderboardPublishTime || null,
    leaderboardStatus: newCompData.leaderboardStatus || 'NOT_PUBLISHED',
    leaderboardPublishedAt: newCompData.leaderboardPublishedAt || null,
    answerReviewEnabled: Boolean(newCompData.answerReviewEnabled)
  };

  const res = await apiPost('/competitions', payload);
  if (res && res.success) {
    await logActivity('Competitions', 'Competition Created', `New competition "${payload.title}" created.`);
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to create competition');
};

export const updateCompetition = async (id, updatedData) => {
  if (!id) {
    return apiResponse(null, false, 'Competition ID is required');
  }
  const payload = {
    title: (updatedData.title || updatedData.name || '').trim(),
    category: updatedData.category || 'Academic',
    description: updatedData.description || '',
    startDate: updatedData.startDate || '',
    endDate: updatedData.endDate || '',
    regStartDate: updatedData.regStartDate || '',
    regEndDate: updatedData.regEndDate || '',
    startTime: updatedData.startTime || '',
    endTime: updatedData.endTime || '',
    venue: updatedData.venue || '',
    bannerUrl: updatedData.bannerUrl || '',
    rulesPdfUrl: updatedData.rulesPdfUrl || '',
    instructions: updatedData.instructions || '',
    rules: updatedData.rules || '',
    contactDetails: updatedData.contactDetails || '',
    registrationFee: parseFloat(updatedData.registrationFee || 0),
    status: updatedData.status || 'Active',
    regStartAt: updatedData.regStartAt || null,
    regEndAt: updatedData.regEndAt || null,
    startAt: updatedData.startAt || null,
    endAt: updatedData.endAt || null,
    finalUnlockAt: updatedData.finalUnlockAt || null,
    leaderboardPublishTime: updatedData.leaderboardPublishTime || null,
    leaderboardStatus: updatedData.leaderboardStatus || undefined,
    leaderboardPublishedAt: updatedData.leaderboardPublishedAt || undefined,
    answerReviewEnabled: updatedData.answerReviewEnabled !== undefined ? Boolean(updatedData.answerReviewEnabled) : undefined
  };

  const res = await apiPut(`/competitions/${encodeURIComponent(id)}`, payload);
  if (res && res.success) {
    await logActivity('Competitions', 'Competition Updated', `Updated competition "${payload.title || id}"`);
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to update competition');
};

export const deleteCompetition = async (id) => {
  if (!id) {
    return apiResponse(false, false, 'Competition ID is required');
  }
  const res = await apiDelete(`/competitions/${encodeURIComponent(id)}`);
  if (res && res.success) {
    await logActivity('Competitions', 'Competition Deleted', `Deleted competition "${id}"`);
    return apiResponse(true);
  }
  return apiResponse(false, false, res?.message || 'Failed to delete competition');
};

// --- PORTALS API ---
export const getMyPortals = async () => {
  const res = await apiGet('/me/portals');
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse({ learning: false, competition: false, competitions: [], defaultPortal: null }, false, res?.message);
};

// --- STUDENT COMPETITION PORTAL CONTEXT ---
export const getCompetitionPortalContext = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/my-portal`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to load competition portal details');
};

// --- SETS & TRAINERS ---
export const getCompetitionSets = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/sets`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch sets');
};

export const assignTrainerToSet = async (competitionId, code, trainerId) => {
  const res = await apiPut(`/competitions/${encodeURIComponent(competitionId)}/sets/${encodeURIComponent(code)}/trainer`, { trainerId });
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to assign trainer to set');
};

// --- SYLLABUS ---
export const getCompetitionSyllabus = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/syllabus`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch syllabus');
};

export const saveCompetitionSyllabus = async (competitionId, payloadOrTitle, maybeStoredId, maybeFileType) => {
  let body = {};
  if (typeof payloadOrTitle === 'object' && payloadOrTitle !== null) {
    body = payloadOrTitle;
  } else {
    body = {
      title: payloadOrTitle,
      storedFileId: maybeStoredId,
      fileType: maybeFileType
    };
  }
  const res = await apiPost(`/competitions/${encodeURIComponent(competitionId)}/syllabus`, body);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to save syllabus');
};

export const deleteCompetitionSyllabus = async (competitionId) => {
  const res = await apiDelete(`/competitions/${encodeURIComponent(competitionId)}/syllabus`);
  if (res && res.success) {
    return apiResponse(true);
  }
  return apiResponse(false, false, res?.message || 'Failed to delete syllabus');
};

// --- GUIDANCE VIDEOS ---
export const getCompetitionGuidanceVideos = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/guidance-videos`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch guidance videos');
};

export const saveCompetitionGuidanceVideo = async (competitionId, video) => {
  const res = await apiPost(`/competitions/${encodeURIComponent(competitionId)}/guidance-videos`, video);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to save guidance video');
};

export const deleteCompetitionGuidanceVideo = async (videoId) => {
  const res = await apiDelete(`/competitions/guidance-videos/${encodeURIComponent(videoId)}`);
  if (res && res.success) {
    return apiResponse(true);
  }
  return apiResponse(false, false, res?.message || 'Failed to delete guidance video');
};

export const reorderCompetitionGuidanceVideos = async (competitionId, videoIds) => {
  const res = await apiPut(`/competitions/${encodeURIComponent(competitionId)}/guidance-videos/reorder`, videoIds);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to reorder guidance videos');
};

export const uploadCompetitionGuidanceVideo = async (competitionId, file, caption, sortOrder = 0) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('caption', caption);
  if (sortOrder) formData.append('sortOrder', sortOrder);

  const token = getAuthToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE_URL}/competitions/${encodeURIComponent(competitionId)}/guidance-videos/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json && json.success) {
      return apiResponse(json.data);
    }
    return apiResponse(null, false, json?.message || 'Failed to upload guidance video');
  } catch (err) {
    return apiResponse(null, false, err.message || 'Upload failed');
  }
};

export const updateCompetitionGuidanceVideo = async (videoId, { caption, sortOrder }) => {
  const res = await apiPut(`/competitions/guidance-videos/${encodeURIComponent(videoId)}`, { caption, sortOrder });
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to update guidance video');
};

export const replaceCompetitionGuidanceVideo = async (videoId, file, caption = '') => {
  const formData = new FormData();
  formData.append('file', file);
  if (caption) formData.append('caption', caption);

  const token = getAuthToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE_URL}/competitions/guidance-videos/${encodeURIComponent(videoId)}/replace`, {
      method: 'PUT',
      headers,
      body: formData
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json && json.success) {
      return apiResponse(json.data);
    }
    return apiResponse(null, false, json?.message || 'Failed to replace guidance video');
  } catch (err) {
    return apiResponse(null, false, err.message || 'Replacement failed');
  }
};

// --- STUDY MATERIALS ---
export const getCompetitionStudyMaterials = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/study-materials`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch study materials');
};

export const saveCompetitionStudyMaterial = async (competitionId, material) => {
  const res = await apiPost(`/competitions/${encodeURIComponent(competitionId)}/study-materials`, material);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to save study material');
};

export const deleteCompetitionStudyMaterial = async (materialId) => {
  const res = await apiDelete(`/competitions/study-materials/${encodeURIComponent(materialId)}`);
  if (res && res.success) {
    return apiResponse(true);
  }
  return apiResponse(false, false, res?.message || 'Failed to delete study material');
};

// --- ASSESSMENTS & QUESTIONS ---
export const getCompetitionAssessments = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/assessments`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch assessments');
};

export const updateCompetitionAssessment = async (asmtId, updated) => {
  const res = await apiPut(`/competitions/assessments/${encodeURIComponent(asmtId)}`, updated);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to update assessment');
};

export const getAssessmentQuestions = async (asmtId) => {
  const res = await apiGet(`/competitions/assessments/${encodeURIComponent(asmtId)}/questions`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch questions');
};

export const saveAssessmentQuestion = async (asmtId, payload) => {
  const res = await apiPost(`/competitions/assessments/${encodeURIComponent(asmtId)}/questions`, payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to save question');
};

export const deleteAssessmentQuestion = async (questionId) => {
  const res = await apiDelete(`/competitions/questions/${encodeURIComponent(questionId)}`);
  if (res && res.success) {
    return apiResponse(true);
  }
  return apiResponse(false, false, res?.message || 'Failed to delete question');
};

export const duplicateAssessmentQuestion = async (questionId) => {
  const res = await apiPost(`/competitions/questions/${encodeURIComponent(questionId)}/duplicate`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to duplicate question');
};

export const reorderAssessmentQuestions = async (asmtId, questionIds) => {
  const res = await apiPut(`/competitions/assessments/${encodeURIComponent(asmtId)}/questions/reorder`, questionIds);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to reorder questions');
};

export const publishCompetitionAssessment = async (asmtId) => {
  const res = await apiPost(`/competitions/assessments/${encodeURIComponent(asmtId)}/publish`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to publish assessment');
};

export const republishCompetitionAssessment = async (asmtId) => {
  const res = await apiPost(`/competitions/assessments/${encodeURIComponent(asmtId)}/republish`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to republish assessment');
};

export const getAssessmentRepublishInfo = async (asmtId) => {
  const res = await apiGet(`/competitions/assessments/${encodeURIComponent(asmtId)}/republish-info`);
  if (res && (res.success || res.attemptCount !== undefined || res.data)) {
    return apiResponse(res.data || res);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch republish info');
};

// --- COMPETITION MANAGEMENT (OVERVIEW & STUDENTS) ---
export const getCompetitionOverview = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/overview`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch competition overview');
};

export const getCompetitionRegisteredStudents = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/registered-students`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch registered students');
};

// --- PHASE 1: TEST SERIES & ASSESSMENT EXECUTION ---
export const getStudentTestSeries = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/test-series`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch test series');
};

export const startTestSeriesAttempt = async (asmtId) => {
  const res = await apiPost(`/competitions/test-series/${encodeURIComponent(asmtId)}/start`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to start test');
};

export const saveAssessmentAnswer = async (asmtId, payload) => {
  const res = await apiPost(`/competitions/test-series/${encodeURIComponent(asmtId)}/answers`, payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to save answer');
};

export const submitTestSeriesAttempt = async (asmtId) => {
  const res = await apiPost(`/competitions/test-series/${encodeURIComponent(asmtId)}/submit`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to submit test');
};

export const getAssessmentResults = async (asmtId) => {
  const res = await apiGet(`/competitions/test-series/${encodeURIComponent(asmtId)}/results`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch test results');
};

export const resetAssessmentAttempt = async (asmtId, attemptId) => {
  const res = await apiPost(`/competitions/assessments/${encodeURIComponent(asmtId)}/attempts/${encodeURIComponent(attemptId)}/reset`, {});
  if (res && res.success) {
    return apiResponse(true);
  }
  return apiResponse(false, false, res?.message || 'Failed to reset attempt');
};

// --- PHASE 2: MOCK TESTS API ---
export const getStudentMockTests = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/mock-tests`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse({ mockTests: [] }, false, res?.message || 'Failed to fetch mock tests');
};

export const startMockTestAttempt = async (asmtId) => {
  const res = await apiPost(`/competitions/mock-tests/${encodeURIComponent(asmtId)}/start`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to start mock test');
};

export const saveMockAssessmentAnswer = async (asmtId, payload) => {
  const res = await apiPost(`/competitions/mock-tests/${encodeURIComponent(asmtId)}/answers`, payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to save answer');
};

export const submitMockTestAttempt = async (asmtId) => {
  const res = await apiPost(`/competitions/mock-tests/${encodeURIComponent(asmtId)}/submit`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to submit mock test');
};

export const getMockAssessmentResults = async (asmtId) => {
  const res = await apiGet(`/competitions/mock-tests/${encodeURIComponent(asmtId)}/results`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch mock test results');
};

// --- PHASE 3: FINAL ASSESSMENT API ---
export const getStudentFinalAssessment = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/final-assessment`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch final assessment');
};

export const startFinalAssessmentAttempt = async (asmtId) => {
  const res = await apiPost(`/competitions/final-assessment/${encodeURIComponent(asmtId)}/start`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to start final assessment');
};

export const saveFinalAssessmentAnswer = async (asmtId, payload) => {
  const res = await apiPost(`/competitions/final-assessment/${encodeURIComponent(asmtId)}/answers`, payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to save answer');
};

export const submitFinalAssessmentAttempt = async (asmtId) => {
  const res = await apiPost(`/competitions/final-assessment/${encodeURIComponent(asmtId)}/submit`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to submit final assessment');
};

export const getFinalAssessmentResults = async (asmtId) => {
  const res = await apiGet(`/competitions/final-assessment/${encodeURIComponent(asmtId)}/results`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch final assessment results');
};

export const generateSetPapers = async (asmtId) => {
  const res = await apiPost(`/competitions/assessments/${encodeURIComponent(asmtId)}/generate-sets`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to generate set papers');
};

// --- PHASE 4: TRAINER EVALUATION API ---
export const getTrainerCompetitionEvaluations = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/trainer/evaluations`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch trainer evaluations');
};

export const getTrainerAttemptDetail = async (attemptId) => {
  const res = await apiGet(`/competitions/trainer/attempts/${encodeURIComponent(attemptId)}`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch attempt details');
};

export const evaluateVoiceAnswer = async (attemptId, answerId, payload) => {
  const res = await apiPost(`/competitions/trainer/attempts/${encodeURIComponent(attemptId)}/answers/${encodeURIComponent(answerId)}/evaluate`, payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to evaluate voice answer');
};

export const getAdminCompetitionEvaluations = async ({ competitionId = '', examType = '', setCode = '', status = '', search = '' } = {}) => {
  const params = new URLSearchParams();
  if (competitionId && competitionId !== 'all') params.append('competitionId', competitionId);
  if (examType && examType !== 'all') params.append('examType', examType);
  if (setCode && setCode !== 'all') params.append('setCode', setCode);
  if (status && status !== 'all') params.append('status', status);
  if (search) params.append('search', search);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiGet(`/competitions/admin/evaluations${query}`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch admin evaluations');
};

// --- PHASE 5: LEADERBOARD API ---
export const getCompetitionLeaderboard = async (competitionId) => {
  const res = await apiGet(`/competitions/${encodeURIComponent(competitionId)}/leaderboard`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to load leaderboard');
};

export const recalculateCompetitionLeaderboard = async (competitionId) => {
  const res = await apiPost(`/competitions/${encodeURIComponent(competitionId)}/leaderboard/recalculate`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to recalculate leaderboard');
};

export const publishCompetitionLeaderboard = async (competitionId) => {
  const res = await apiPost(`/competitions/${encodeURIComponent(competitionId)}/leaderboard/publish`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to publish leaderboard');
};

export const unpublishCompetitionLeaderboard = async (competitionId) => {
  const res = await apiPost(`/competitions/${encodeURIComponent(competitionId)}/leaderboard/unpublish`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to unpublish leaderboard');
};

export const toggleCompetitionAnswerReview = async (competitionId) => {
  const res = await apiPost(`/competitions/${encodeURIComponent(competitionId)}/answer-review/toggle`, {});
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to toggle answer review');
};

export const getTrainerAssignedCompetitions = async () => {
  const res = await apiGet('/competitions/trainer/assigned-competitions');
  if (res && res.success && Array.isArray(res.data)) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch assigned competitions');
};

export const getTrainerFilteredSubmissions = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.competitionId && filters.competitionId !== 'ALL') params.append('competitionId', filters.competitionId);
  if (filters.examType && filters.examType !== 'ALL') params.append('examType', filters.examType);
  if (filters.setCode && filters.setCode !== 'ALL') params.append('setCode', filters.setCode);
  if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiGet(`/competitions/trainer/submissions${query}`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch trainer submissions');
};

// --- PROCTORING API (N2) ---
export const recordProctorEvent = async (attemptId, eventType, metadata = {}) => {
  const res = await apiPost(`/competitions/assessments/attempts/${encodeURIComponent(attemptId)}/proctor-event`, {
    eventType,
    metadata
  });
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to record proctor event');
};

export const getProctorEvents = async (attemptId) => {
  const res = await apiGet(`/competitions/assessments/attempts/${encodeURIComponent(attemptId)}/proctor-events`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch proctor events');
};

// --- TRAINER 3-LEVEL HIERARCHY API (N8) ---
export const getTrainerStudents = async (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.append('page', params.page);
  if (params.size !== undefined) qs.append('size', params.size);
  if (params.competitionId && params.competitionId !== 'ALL') qs.append('competitionId', params.competitionId);
  if (params.setCode && params.setCode !== 'ALL') qs.append('setCode', params.setCode);
  if (params.search) qs.append('search', params.search);

  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiGet(`/competitions/trainer/students${query}`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 20 }, false, res?.message || 'Failed to fetch students');
};

export const getTrainerStudentFolders = async (registrationId) => {
  const res = await apiGet(`/competitions/trainer/students/${encodeURIComponent(registrationId)}/folders`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to fetch student folders');
};

export const getTrainerStudentSubmissions = async (registrationId, folder) => {
  const query = folder ? `?type=${encodeURIComponent(folder)}&folderType=${encodeURIComponent(folder)}&folder=${encodeURIComponent(folder)}` : '';
  const res = await apiGet(`/competitions/trainer/students/${encodeURIComponent(registrationId)}/submissions${query}`);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse({ submissions: [] }, false, res?.message || 'Failed to fetch student submissions');
};

export const getCompetitionActivityLogs = async ({ fromDate, toDate, competitionId, eventType } = {}) => {
  const params = new URLSearchParams();
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);
  if (competitionId) params.append('competitionId', competitionId);
  if (eventType) params.append('eventType', eventType);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiGet(`/competitions/activity-logs${query}`);
  if (res && res.success && Array.isArray(res.data)) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch competition activity logs');
};





