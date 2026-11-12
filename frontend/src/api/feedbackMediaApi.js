import { apiGet, apiPut, apiDelete, getAuthToken, API_BASE_URL } from './client';

/**
 * Public: Get active and ready feedback media items for the landing page.
 */
export async function getPublishedFeedbackMedia() {
  const res = await apiGet('/feedback-media');
  return res;
}

/**
 * Public: Get rate-limited video playback authorization for a feedback video.
 */
export async function getFeedbackVideoPlayback(id) {
  const res = await apiGet(`/feedback-media/${encodeURIComponent(id)}/playback`);
  return res;
}

/**
 * Admin: Get all feedback media items.
 */
export async function getAllFeedbackMedia() {
  const res = await apiGet('/admin/feedback-media');
  return res;
}

/**
 * Admin: Upload feedback media files (images & videos).
 * Supports per-file or batch progress callback.
 */
export async function uploadFeedbackMedia(files, onProgress = null) {
  return new Promise((resolve, reject) => {
    if (!files || files.length === 0) {
      reject(new Error('No files provided for upload.'));
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/admin/feedback-media/upload`);

    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && response.success) {
          resolve(response);
        } else {
          const msg = response.message || response.error || `Upload failed with status ${xhr.status}`;
          reject(new Error(msg));
        }
      } catch (_err) {
        reject(new Error(`Invalid server response: ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during feedback media upload.'));
    };

    xhr.send(formData);
  });
}

/**
 * Admin: Update sort orders for feedback media items.
 */
export async function updateFeedbackMediaOrder(orderedIds) {
  const res = await apiPut('/admin/feedback-media/order', orderedIds);
  return res;
}

/**
 * Admin: Delete a feedback media item and purge storage.
 */
export async function deleteFeedbackMedia(id) {
  const res = await apiDelete(`/admin/feedback-media/${encodeURIComponent(id)}`);
  return res;
}

/**
 * Admin: Check/sync status of a processing feedback video.
 */
export async function getFeedbackMediaStatus(id) {
  const res = await apiGet(`/admin/feedback-media/${encodeURIComponent(id)}/status`);
  return res;
}
