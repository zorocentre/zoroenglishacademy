/**
 * Zoro English Academy - Safe Share Modal Script
 * Fixed: Null-checks all DOM elements before attaching event listeners
 * to prevent "Cannot read properties of null (reading 'addEventListener')" errors.
 */
(function () {
  function initShareModal() {
    try {
      const shareBtn = document.getElementById('share-btn') || document.querySelector('[data-share-modal-open]');
      const shareModal = document.getElementById('share-modal') || document.querySelector('.share-modal');
      const closeBtn = document.getElementById('share-close-btn') || document.querySelector('[data-share-modal-close]');

      if (shareBtn && typeof shareBtn.addEventListener === 'function') {
        shareBtn.addEventListener('click', function (e) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (shareModal) {
            shareModal.classList.remove('hidden');
            shareModal.style.display = 'flex';
            shareModal.setAttribute('aria-hidden', 'false');
          }
        });
      }

      if (closeBtn && typeof closeBtn.addEventListener === 'function') {
        closeBtn.addEventListener('click', function (e) {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          if (shareModal) {
            shareModal.classList.add('hidden');
            shareModal.style.display = 'none';
            shareModal.setAttribute('aria-hidden', 'true');
          }
        });
      }

      if (shareModal && typeof shareModal.addEventListener === 'function') {
        shareModal.addEventListener('click', function (e) {
          if (e.target === shareModal) {
            shareModal.classList.add('hidden');
            shareModal.style.display = 'none';
            shareModal.setAttribute('aria-hidden', 'true');
          }
        });
      }
    } catch (err) {
      console.warn('Share modal initialization safely handled:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShareModal);
  } else {
    initShareModal();
  }
})();
