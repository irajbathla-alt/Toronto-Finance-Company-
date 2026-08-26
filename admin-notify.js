(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const FIELDS = [
    'status','advisor','messageTitle','messageBody','approvedAmount','quote','term',
    'paymentFrequency','paymentAmount','numberPayments','totalRepayment','documentsRequested','notes'
  ];
  let currentApplicationId = '';

  document.addEventListener('click', event => {
    const openButton = event.target.closest('[data-open]');
    if (openButton?.dataset?.open) currentApplicationId = openButton.dataset.open;
  }, true);

  function applicationId() {
    if (currentApplicationId) return currentApplicationId;
    const match = String($('#dTitle')?.textContent || '').match(/TFC-\d+/i);
    return match ? match[0] : '';
  }

  function jsonp(action, payload = {}, timeout = 45000) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM endpoint is not configured.'));
      const callback = `tfc_notify_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The notification request timed out.'));
      }, timeout);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callback] = data => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('The notification service could not be reached.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function buildUpdate() {
    const update = {
      applicationId: applicationId(),
      notifyClient: 'true'
    };
    FIELDS.forEach(key => {
      const field = $('#' + key);
      if (field) update[key] = field.value;
    });
    return update;
  }

  async function saveAndNotify() {
    const button = $('#saveNotify');
    const saveButton = $('#save');
    const message = $('#saveMsg');
    const update = buildUpdate();

    if (!update.applicationId) {
      if (message) {
        message.className = 'notice error';
        message.textContent = 'Open a client file before sending a notification.';
      }
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Sending…';
    }
    if (saveButton) saveButton.disabled = true;
    if (message) {
      message.className = 'notice';
      message.textContent = 'Saving the client update and sending a secure notification…';
    }

    try {
      const result = await jsonp('adminUpdate', update);
      if (!result?.ok) throw new Error(result?.error || 'The client update could not be saved.');

      const notification = result.notification || {};
      if (!notification.sent) {
        throw new Error(notification.error || 'The update was saved, but the client notification was not sent.');
      }

      if ($('#summaryStatus') && result.data?.status) $('#summaryStatus').textContent = result.data.status;
      if ($('#summaryAdvisor')) $('#summaryAdvisor').textContent = result.data?.advisor || 'Unassigned';
      if ($('#previewTitle')) $('#previewTitle').textContent = result.data?.messageTitle || 'Welcome';
      if ($('#previewBody')) $('#previewBody').textContent = result.data?.messageBody || 'Your advisor message will appear here.';

      if (message) {
        message.className = 'notice success';
        message.textContent = `Saved successfully. Client notification sent from ${notification.sender || 'info@torontofinancecompany.com'}.`;
      }

      const refresh = $('#refresh');
      if (refresh && !refresh.disabled) refresh.click();
    } catch (error) {
      if (message) {
        message.className = 'notice error';
        message.textContent = error.message || 'The client notification could not be sent.';
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Save & Notify Client';
      }
      if (saveButton) saveButton.disabled = false;
    }
  }

  const notifyButton = $('#saveNotify');
  if (notifyButton) notifyButton.onclick = saveAndNotify;
})();

(() => {
  'use strict';

  const SESSION_KEY = 'tfc-admin-session';
  const SESSION_TTL = 8 * 60 * 60 * 1000;
  const $ = selector => document.querySelector(selector);

  function readSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (!session.authenticatedAt) return null;
      if (Date.now() - Number(session.authenticatedAt) > SESSION_TTL) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
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

  const admin = $('#admin');
  const login = $('#login');
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

  if (readSession()) {
    login?.classList.add('hidden');
    admin?.classList.remove('hidden');
    logout?.classList.remove('hidden');
    requestAnimationFrame(() => {
      const refresh = $('#refresh');
      if (refresh && !refresh.disabled) refresh.click();
    });
  }
})();
