(() => {
  'use strict';

  const SESSION_KEY = 'tfc-admin-session';
  const SESSION_TTL = 8 * 60 * 60 * 1000;
  const $ = selector => document.querySelector(selector);

  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (!value.authenticatedAt) return null;
      if (Date.now() - Number(value.authenticatedAt) > SESSION_TTL) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return value;
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function saveSession() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ authenticatedAt: Date.now() }));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function restoreSession() {
    if (!readSession()) return;

    $('#login')?.classList.add('hidden');
    $('#admin')?.classList.remove('hidden');
    $('#logoutBtn')?.classList.remove('hidden');

    requestAnimationFrame(() => {
      const refresh = $('#refresh');
      if (refresh && !refresh.disabled) refresh.click();
    });
  }

  function install() {
    const admin = $('#admin');
    const logout = $('#logoutBtn');

    if (admin) {
      const observer = new MutationObserver(() => {
        if (!admin.classList.contains('hidden')) saveSession();
      });
      observer.observe(admin, { attributes: true, attributeFilter: ['class'] });
    }

    if (logout) {
      logout.onclick = () => {
        clearSession();
        location.reload();
      };
    }

    restoreSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
