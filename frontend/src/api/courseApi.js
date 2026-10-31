import { apiGet, apiPost, apiPut, apiDelete, apiResponse } from './client';
import { parseJsonField } from '../utils/jsonUtils';

export { parseJsonField };

/**
 * Normalizes a module object so the UI always receives predictable shapes:
 * - videoStorageRef: { videoId, status } or null
 * - files & thumbnails: both explicit fields and legacy aliases populated
 */
export function normalizeModule(m) {
  if (!m) return m;

  const videoRef = parseJsonField(m.videoStorageRef);

  const notesUrl = m.notesFileUrl || m.notesFile?.fileUrl || (typeof m.notesFile === 'string' ? m.notesFile : '') || m.notesPdf?.fileUrl || '';
  const notesName = m.notesFileName || m.notesFile?.name || m.notesPdf?.name || (notesUrl ? 'Notes Document' : '');
  const notesObj = notesUrl ? { name: notesName, fileUrl: notesUrl, type: 'pdf' } : (m.notesFile && typeof m.notesFile === 'object' ? m.notesFile : null);

  const worksheetUrl = m.worksheetFileUrl || m.worksheetFile?.fileUrl || (typeof m.worksheetFile === 'string' ? m.worksheetFile : '') || m.activitySheetPdf?.fileUrl || '';
  const worksheetName = m.worksheetFileName || m.worksheetFile?.name || m.activitySheetPdf?.name || (worksheetUrl ? 'Worksheet Document' : '');
  const worksheetObj = worksheetUrl ? { name: worksheetName, fileUrl: worksheetUrl, type: 'pdf' } : (m.worksheetFile && typeof m.worksheetFile === 'object' ? m.worksheetFile : null);

  const assignmentUrl = m.assignmentFileUrl || m.assignmentFile?.fileUrl || (typeof m.assignmentFile === 'string' ? m.assignmentFile : '') || m.assignmentPdf?.fileUrl || '';
  const assignmentName = m.assignmentFileName || m.assignmentFile?.name || m.assignmentPdf?.name || (assignmentUrl ? 'Assignment Document' : '');
  const assignmentObj = assignmentUrl ? { name: assignmentName, fileUrl: assignmentUrl, type: 'pdf' } : (m.assignmentFile && typeof m.assignmentFile === 'object' ? m.assignmentFile : null);

  const thumbnail = m.thumbnailUrl || m.thumbnail || '';

  return {
    ...m,
    thumbnail,
    thumbnailUrl: thumbnail,
    notesFile: notesObj,
    notesPdf: notesObj,
    notesFileUrl: notesUrl || null,
    notesFileName: notesName || null,
    worksheetFile: worksheetObj,
    activitySheetPdf: worksheetObj,
    worksheetFileUrl: worksheetUrl || null,
    worksheetFileName: worksheetName || null,
    assignmentFile: assignmentObj,
    assignmentPdf: assignmentObj,
    assignmentFileUrl: assignmentUrl || null,
    assignmentFileName: assignmentName || null,
    videoStorageRef: videoRef
  };
}

export function normalizeCourse(c) {
  if (!c) return c;
  return {
    ...c,
    modules: Array.isArray(c.modules) ? c.modules.map(normalizeModule) : []
  };
}

export const getCourses = async (audience = null) => {
  const url = audience ? `/courses?audience=${encodeURIComponent(audience)}` : '/courses';
  const res = await apiGet(url);
  if (res.success && Array.isArray(res.data)) {
    return apiResponse(res.data.map(normalizeCourse));
  }
  return apiResponse([], false, res?.message || 'Failed to fetch courses');
};

export const getMyCourses = async () => {
  const res = await apiGet('/me/courses');
  if (res.success && Array.isArray(res.data)) {
    return apiResponse(res.data.map(normalizeCourse));
  }
  return apiResponse([], false, res?.message || 'Failed to fetch enrolled courses');
};

export const getMyTrainerCourses = async () => {
  const res = await apiGet('/me/trainer-courses');
  if (res.success && res.data) {
    return apiResponse({
      enrolled: Array.isArray(res.data.enrolled) ? res.data.enrolled.map(normalizeCourse) : [],
      pending: Array.isArray(res.data.pending) ? res.data.pending.map(normalizeCourse) : [],
      available: Array.isArray(res.data.available) ? res.data.available.map(normalizeCourse) : []
    });
  }
  return apiResponse({ enrolled: [], pending: [], available: [] }, false, res?.message || 'Failed to fetch trainer courses');
};

export const getCourseById = async (id) => {
  if (!id) {
    return apiResponse(null, false, 'Course ID is required');
  }
  const res = await apiGet(`/courses/${encodeURIComponent(id)}`);
  if (res.success && res.data) {
    return apiResponse(normalizeCourse(res.data));
  }
  return apiResponse(null, false, res?.message || 'Course not found');
};

export const createCourse = async (newCourseData) => {
  if (!newCourseData?.title) {
    return apiResponse(null, false, 'Course title is required');
  }
  const res = await apiPost('/courses', newCourseData);
  if (res.success && res.data) {
    return apiResponse(normalizeCourse(res.data), true, 'Course created successfully');
  }
  return apiResponse(null, false, res?.message || 'Failed to create course');
};

export const updateCourse = async (id, updatedData) => {
  if (!id) {
    return apiResponse(null, false, 'Course ID is required');
  }
  const res = await apiPut(`/courses/${encodeURIComponent(id)}`, updatedData);
  if (res.success && res.data) {
    return apiResponse(normalizeCourse(res.data), true, 'Course updated successfully');
  }
  return apiResponse(null, false, res?.message || 'Failed to update course');
};

export const deleteCourse = async (id) => {
  if (!id) {
    return apiResponse(false, false, 'Course ID is required');
  }
  const res = await apiDelete(`/courses/${encodeURIComponent(id)}`);
  if (res.success) {
    return apiResponse(true, true, 'Course deleted successfully');
  }
  return apiResponse(false, false, res?.message || 'Failed to delete course');
};

export const addModule = async (courseId, moduleData) => {
  if (!courseId) {
    return apiResponse(null, false, 'Course ID is required');
  }
  const res = await apiPost(`/courses/${encodeURIComponent(courseId)}/modules`, moduleData);
  if (res.success && res.data) {
    return apiResponse(normalizeModule(res.data), true, 'Module added successfully');
  }
  return apiResponse(null, false, res?.message || 'Failed to add module');
};

export const updateModule = async (courseId, moduleId, updatedModuleData) => {
  if (!courseId || !moduleId) {
    return apiResponse(null, false, 'Course ID and Module ID are required');
  }
  const res = await apiPut(`/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}`, updatedModuleData);
  if (res.success && res.data) {
    return apiResponse(normalizeModule(res.data), true, 'Module updated successfully');
  }
  return apiResponse(null, false, res?.message || 'Failed to update module');
};

export const deleteModule = async (courseId, moduleId) => {
  if (!courseId || !moduleId) {
    return apiResponse(false, false, 'Course ID and Module ID are required');
  }
  const res = await apiDelete(`/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}`);
  if (res.success) {
    return apiResponse(true, true, 'Module deleted successfully');
  }
  return apiResponse(false, false, res?.message || 'Failed to delete module');
};

export const reorderModules = async (courseId, moduleIds) => {
  if (!courseId) {
    return apiResponse(null, false, 'Course ID is required');
  }
  if (!Array.isArray(moduleIds)) {
    return apiResponse(null, false, 'moduleIds array is required');
  }
  const res = await apiPut(`/courses/${encodeURIComponent(courseId)}/modules/reorder`, { moduleIds });
  if (res.success && res.data) {
    return apiResponse(
      Array.isArray(res.data) ? res.data.map(normalizeModule) : res.data,
      true,
      res.message || 'Modules reordered successfully'
    );
  }
  return apiResponse(null, false, res?.message || 'Failed to reorder modules');
};

export const addLesson = async (courseId, moduleId, lessonData) => {
  if (!courseId || !moduleId) {
    return apiResponse(null, false, 'Course ID and Module ID are required');
  }
  const res = await apiPost(`/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}/lessons`, lessonData);
  if (res.success && res.data) {
    return apiResponse(res.data, true, 'Lesson added successfully');
  }
  return apiResponse(null, false, res?.message || 'Failed to add lesson');
};

// --- TRAINER COURSE REQUESTS API ---
export const getTrainerCourseRequests = async (trainerId = null) => {
  const url = trainerId ? `/trainer-course-requests?trainerId=${encodeURIComponent(trainerId)}` : '/trainer-course-requests';
  const res = await apiGet(url);
  if (res.success && Array.isArray(res.data)) {
    const normalized = res.data.map(r => ({
      id: r.id,
      trainerId: r.trainerId,
      trainerName: r.trainerName,
      trainerEmail: r.trainerEmail,
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      requestedAt: r.requestDate,
      status: r.status
    }));
    return apiResponse(normalized);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch trainer course requests');
};

export const createTrainerCourseRequest = async ({ trainerId, trainerName, trainerEmail, courseId, courseTitle }) => {
  if (!courseId) {
    return apiResponse(null, false, 'Course ID is required');
  }
  const payload = {
    trainerId: trainerId || trainerEmail,
    trainerName,
    trainerEmail,
    courseId,
    courseTitle,
    status: 'Pending',
    requestDate: new Date().toLocaleDateString('en-GB')
  };
  const res = await apiPost('/trainer-course-requests', payload);
  if (res.success && res.data) {
    return apiResponse(res.data, true, 'Course access requested successfully');
  }
  return apiResponse(null, false, res?.message || 'Failed to request course');
};

export const updateTrainerCourseRequestStatus = async (requestId, status) => {
  if (!requestId) {
    return apiResponse(false, false, 'Request ID is required');
  }
  const res = await apiPut(`/trainer-course-requests/${encodeURIComponent(requestId)}/status`, { status });
  if (res.success) {
    return apiResponse(true, true, 'Status updated');
  }
  return apiResponse(false, false, res?.message || 'Failed to update status');
};

export const deleteTrainerCourseRequest = async (requestId) => {
  if (!requestId) {
    return apiResponse(false, false, 'Request ID is required');
  }
  const res = await apiDelete(`/trainer-course-requests/${encodeURIComponent(requestId)}`);
  if (res.success) {
    return apiResponse(true, true, res.message || 'Request deleted successfully');
  }
  return apiResponse(false, false, res?.message || 'Failed to delete request');
};

export const getCourseDeletionImpact = async (courseId) => {
  if (!courseId) {
    return apiResponse(null, false, 'Course ID is required');
  }
  const res = await apiGet(`/courses/${encodeURIComponent(courseId)}/deletion-impact`);
  if (res.success && res.data) {
    return apiResponse(res.data);
  }
  return apiResponse({ canDelete: false, blockingReasons: [res?.message || 'Failed to check deletion impact'] }, false, res?.message);
};

export const getCourseStudents = async (courseId) => {
  if (!courseId) {
    return apiResponse([], false, 'Course ID is required');
  }
  const res = await apiGet(`/courses/${encodeURIComponent(courseId)}/students`);
  if (res.success && Array.isArray(res.data)) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch course students');
};

export const getTrainerCourseAccessList = async () => {
  const res = await apiGet('/trainer-course-requests/trainer-course-access');
  if (res.success && Array.isArray(res.data)) {
    return apiResponse(res.data);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch trainer course access list');
};

export const revokeTrainerCourseAccess = async (trainerId, courseId) => {
  const res = await apiPost('/trainer-course-requests/revoke-access', { trainerId, courseId });
  if (res.success) {
    return apiResponse(true, true, res.message || 'Trainer course access revoked successfully');
  }
  return apiResponse(false, false, res?.message || 'Failed to revoke trainer course access');
};
