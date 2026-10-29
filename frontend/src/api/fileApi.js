import { getAuthToken, API_BASE_URL, apiDelete } from './client';

/**
 * Resolves a file URL or path for display/download in the frontend.
 * - Leaves absolute URLs (http, https, data:, blob:) unchanged (including Bunny CDN URLs).
 * - Resolves relative /api/files/... paths using backend API_BASE_URL origin.
 * - Resolves bare UUIDs or file paths to /api/files/{id}.
 * 
 * @param {string} urlOrPath 
 * @returns {string} Fully resolved accessible URL
 */
export function resolveFileUrl(urlOrPath) {
  if (!urlOrPath) return '';
  if (typeof urlOrPath !== 'string') return '';

  const trimmed = urlOrPath.trim();
  // Intercept Bunny CDN URLs (e.g. zoro-academy-files-cdn.b-cdn.net) that contain a file UUID
  // and resolve them via the reliable backend /api/files/{id} endpoint
  if (trimmed.includes('.b-cdn.net')) {
    const uuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      return resolveFileUrl(`/api/files/${uuidMatch[0]}`);
    }
  }

  // Intercept hardcoded localhost/127.0.0.1 backend URLs and convert to relative /api/...
  const localhostMatch = trimmed.match(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/api\/.*)$/i);
  if (localhostMatch) {
    return resolveFileUrl(localhostMatch[1]);
  }

  // Already fully qualified URLs or in-memory blobs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Prepend backend origin to relative /api/ paths
  if (trimmed.startsWith('/api/')) {
    try {
      const baseObj = new URL(API_BASE_URL, window.location.origin);
      return `${baseObj.origin}${trimmed}`;
    } catch {
      return trimmed;
    }
  }

  // Handle files/{id}
  if (trimmed.startsWith('files/')) {
    return resolveFileUrl(`/api/${trimmed}`);
  }

  // Handle UUID identifier directly
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return resolveFileUrl(`/api/files/${trimmed}`);
  }

  // Handle standard relative paths starting with /
  if (trimmed.startsWith('/')) {
    try {
      const baseObj = new URL(API_BASE_URL, window.location.origin);
      return `${baseObj.origin}${trimmed}`;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

/**
 * Fetch a temporary signed link for a private stored file.
 * Accepts either a file UUID or a URL/path containing the UUID.
 * 
 * @param {string} fileIdOrUrl 
 * @returns {Promise<{ id: string, url: string, expiresAt: number, isPublic: boolean }>}
 */
export async function getFileLink(fileIdOrUrl, download = false) {
  if (!fileIdOrUrl) return null;
  const str = String(fileIdOrUrl).trim();
  if (!str) return null;

  // If already an external CDN or absolute URL not pointing to backend file route
  if ((str.startsWith('http://') || str.startsWith('https://')) && !str.includes('/api/files/')) {
    return { id: '', url: str, expiresAt: 0, isPublic: true };
  }

  // Extract UUID if present
  const match = str.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const fileId = match ? match[0] : str.replace(/^\/?api\/files\//, '').replace(/\/link$/, '').replace(/\/download$/, '').split('?')[0];

  const token = getAuthToken();
  const headers = { 'Accept': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const downloadQuery = download ? '?download=true' : '';
  const response = await fetch(`${API_BASE_URL}/files/${encodeURIComponent(fileId)}/link${downloadQuery}`, {
    headers
  });

  if (!response.ok) {
    let errJson = null;
    try {
      errJson = await response.json();
    } catch {
      // ignore
    }
    const code = errJson?.code || errJson?.errorCode || `HTTP_${response.status}`;
    const message = errJson?.message || (response.status === 403 ? 'Access denied: You do not have permission to access this file' : `Error accessing file (Status ${response.status})`);
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    error.unlockAt = errJson?.data?.unlockAt || errJson?.unlockAt;
    throw error;
  }

  const data = await response.json();
  if (data && data.success && data.data) {
    return {
      ...data.data,
      url: resolveFileUrl(data.data.url)
    };
  }
  const error = new Error(data?.message || 'Failed to retrieve file link');
  error.code = data?.code || 'UNKNOWN_ERROR';
  throw error;
}

/**
 * Opens or downloads a file through the signed-link flow.
 * Solves 401 on private files opened in new tabs by resolving signed token first.
 * 
 * @param {string} fileUrlOrId 
 * @param {string} [fileName] 
 */
export async function openFileWithSignedLink(fileUrlOrId, fileName = '') {
  if (!fileUrlOrId) return;
  try {
    const linkData = await getFileLink(fileUrlOrId, true);
    let targetUrl = linkData?.url || resolveFileUrl(fileUrlOrId);
    if (!targetUrl) throw new Error('Could not resolve file URL');

    const downloadFileName = fileName || linkData?.name || 'download';

    // If pointing to backend files API, append download=true so Content-Disposition: attachment is returned
    if (targetUrl.includes('/api/files/')) {
      const sep = targetUrl.includes('?') ? '&' : '?';
      if (!targetUrl.includes('download=')) {
        targetUrl = `${targetUrl}${sep}download=true`;
      }
    }

    // Try blob download in browser environment to bypass popup blockers and cross-origin download restrictions
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      try {
        const token = getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const resp = await fetch(targetUrl, { headers });
        if (resp && resp.ok && typeof resp.blob === 'function') {
          const blob = await resp.blob();
          if (blob && typeof window.URL?.createObjectURL === 'function') {
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = downloadFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
            return;
          }
        }
      } catch (blobErr) {
        console.warn('Direct blob fetch failed, falling back to anchor click:', blobErr);
      }
    }

    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('File download/access failed:', err);
    let msg = err?.message || 'Access Denied: File is locked or unavailable.';
    if (err?.code === 'LOCKED_SCHEDULE') {
      msg = err.unlockAt ? `Schedule resources are locked. Unlocks at ${err.unlockAt}` : 'Schedule resources are locked until 60 minutes before session.';
    } else if (err?.code === 'LOCKED_MODULE') {
      msg = err.message || 'Complete previous module to unlock this resource.';
    } else if (err?.code === 'NOT_ENROLLED') {
      msg = 'You are not enrolled in this course.';
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('api:error', {
        detail: {
          message: msg.replace(/^Error:\s*/, ''),
          code: err?.code || 'FILE_ACCESS_DENIED'
        }
      }));
    }
  }
}

/**
 * Upload a file to the backend file storage system with progress callback.
 * 
 * @param {File} file - The file object to upload
 * @param {string} category - Category string (e.g. 'avatar', 'thumbnail', 'banner', 'notes', 'submission')
 * @param {function} onProgress - Callback (percentage integer 0..100)
 * @returns {Promise<{ id: string, url: string, name: string, size: number, contentType: string }>}
 */
export async function uploadFile(file, category = 'document', onProgress = null) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided for upload.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/files`);

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
          const data = response.data || {};
          const fileUrl = data.url || `/api/files/${data.id}`;
          resolve({
            id: data.id,
            url: resolveFileUrl(fileUrl),
            name: data.name || file.name,
            size: data.size || file.size,
            contentType: data.contentType || file.type
          });
        } else {
          const msg = response.message || response.error || `Upload failed with status ${xhr.status}`;
          reject(new Error(msg));
        }
      } catch (err) {
        if (xhr.status === 413) {
          reject(new Error('File size exceeds server limit (HTTP 413 Payload Too Large).'));
        } else if (xhr.status >= 400) {
          reject(new Error(`Server error during upload (${xhr.status}: ${xhr.statusText || 'Error'})`));
        } else {
          reject(new Error('Failed to parse upload server response'));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload. Please check your connection or file size.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload request timed out. Please try again.'));
    };

    xhr.send(formData);
  });
}

/**
 * Delete a stored file from storage and database.
 * 
 * @param {string} fileId
 * @returns {Promise<any>}
 */
export async function deleteFile(fileId) {
  if (!fileId) return null;
  return apiDelete(`/files/${encodeURIComponent(fileId)}`);
}

/**
 * Unified Upload to Bunny Stream (for videos) or Bunny Storage (for audio, images, documents).
 * Supports cancellation via abortController signal or direct abort handle.
 *
 * @param {File} file
 * @param {Object} [options]
 * @param {string} [options.category='auto']
 * @param {string} [options.title]
 * @param {function} [options.onProgress] - (percent: number) => void
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>}
 */
export async function unifiedUpload(file, { category = 'auto', title = '', onProgress = null, signal = null } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided for upload.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (title) {
      formData.append('title', title);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/files/unified-upload`);

    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new Error('Upload cancelled'));
        return;
      }
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Upload cancelled'));
      });
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
          const data = response.data || {};
          resolve({
            ...data,
            url: data.url ? resolveFileUrl(data.url) : resolveFileUrl(`/api/files/${data.id}`),
            name: data.name || data.fileName || file.name,
            size: data.size || file.size,
            contentType: data.contentType || file.type
          });
        } else {
          const msg = response.message || response.error || `Upload failed with status ${xhr.status}`;
          reject(new Error(msg));
        }
      } catch {
        if (xhr.status === 413) {
          reject(new Error('File size exceeds server limit (HTTP 413 Payload Too Large).'));
        } else if (xhr.status >= 400) {
          reject(new Error(`Server error during upload (${xhr.status}: ${xhr.statusText || 'Error'})`));
        } else {
          reject(new Error('Failed to parse upload server response'));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload. Please check your connection or file size.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload request timed out. Please try again.'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload cancelled'));
    };

    xhr.send(formData);
  });
}

/**
 * Returns absolute download URL for a public rules document.
 * 
 * @param {string} rulesPdfUrl
 * @returns {string} Absolute download URL
 */
export function getRulesDownloadUrl(rulesPdfUrl) {
  if (!rulesPdfUrl) return '';
  const match = rulesPdfUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const fileId = match ? match[0] : rulesPdfUrl.replace(/^\/api\/files\//, '').replace(/\/download$/, '');
  const baseObj = new URL(API_BASE_URL, window.location.origin);
  return `${baseObj.origin}/api/files/${encodeURIComponent(fileId)}/download`;
}

