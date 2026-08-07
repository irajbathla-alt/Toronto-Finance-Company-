(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const SESSION_KEY = 'tfc-v2-session';
  const BRIDGE_CHANNEL = 'tfc-crm-bridge';
  const urls = [...new Set([cfg.apiUrl, cfg.apiFallbackUrl].filter(Boolean))];

  const makeId = () => window.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function getSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!value?.token || !value?.role) return null;
      if (value.expiresAt && Date.now() > Number(value.expiresAt)) {
        clearSession();
        return null;
      }
      return value;
    } catch (_) {
      return null;
    }
  }

  function setSession(value) {
    if (!value?.token || !value?.role) throw new Error('Invalid CRM session.');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('tfc-current-application');
    sessionStorage.removeItem('tfc-client-auth');
  }

  function jsonpAt(url, action, payload = {}, timeout = 15000) {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error('CRM endpoint is missing.'));
      const callback = `tfc_api_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('CRM endpoint timed out.'));
      }, timeout);
      function cleanup() {
        clearTimeout(timer);
        delete window[callback];
        script.remove();
      }
      window[callback] = result => {
        cleanup();
        resolve(result);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error('CRM endpoint could not be reached.'));
      };
      script.src = `${url}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function callSmall(action, payload = {}, timeout = 15000) {
    const session = getSession();
    const request = { ...payload };
    if (session?.token && !request.token) request.token = session.token;
    let lastNetworkError = null;

    for (const url of urls) {
      try {
        const result = await jsonpAt(url, action, request, timeout);
        if (!result?.ok) throw new Error(result?.error || 'CRM operation failed.');
        return result;
      } catch (error) {
        if (!/timed out|could not be reached|endpoint is missing/i.test(error.message || '')) throw error;
        lastNetworkError = error;
      }
    }
    throw lastNetworkError || new Error('Cannot reach the CRM service.');
  }

  async function get(action, payload = {}, options = {}) {
    return callSmall(action, payload, options.timeout || 15000);
  }

  function bridgePostAt(url, request, timeout = 65000) {
    return new Promise((resolve, reject) => {
      const requestId = request.requestId || makeId();
      request.requestId = requestId;
      const iframe = document.createElement('iframe');
      iframe.name = `tfc_bridge_${requestId.replace(/[^a-zA-Z0-9]/g, '')}`;
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'display:none!important;width:0;height:0;border:0';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url;
      form.target = iframe.name;
      form.style.display = 'none';

      const add = (name, value, tag = 'input') => {
        const el = document.createElement(tag);
        el.name = name;
        if (tag === 'input') el.type = 'hidden';
        el.value = value;
        form.appendChild(el);
      };
      add('bridge', '1');
      add('requestId', requestId);
      add('payload', JSON.stringify(request), 'textarea');
      document.body.appendChild(form);

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Upload response timed out.'));
      }, timeout);

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        form.remove();
        setTimeout(() => iframe.remove(), 0);
      }

      function onMessage(event) {
        if (event.source !== iframe.contentWindow) return;
        const message = event.data;
        if (!message || message.channel !== BRIDGE_CHANNEL || message.requestId !== requestId) return;
        cleanup();
        const result = message.result;
        if (!result?.ok) return reject(new Error(result?.error || 'Upload failed.'));
        resolve(result);
      }

      window.addEventListener('message', onMessage);
      form.submit();
    });
  }

  async function uploadDocument(payload, options = {}) {
    const session = getSession();
    if (!session?.token) throw new Error('Secure session required. Please log in again.');
    const request = { action: 'uploadDocument', requestId: makeId(), token: session.token, ...payload };
    let lastError = null;

    for (const url of urls) {
      try {
        return await bridgePostAt(url, request, options.timeout || 65000);
      } catch (error) {
        lastError = error;
        try {
          const docs = await callSmall('getDocuments', { applicationId: payload.applicationId }, 12000);
          const exists = (docs.data || []).some(item => String(item.name) === String(payload.fileName));
          if (exists) {
            const current = await callSmall('getClient', { applicationId: payload.applicationId }, 12000);
            return { ok: true, data: current.data, recovered: true };
          }
        } catch (_) {}
      }
    }
    throw lastError || new Error('Document upload could not be completed.');
  }

  async function post(action, payload = {}, options = {}) {
    if (action === 'uploadDocument') return uploadDocument(payload, options);
    return callSmall(action, payload, options.timeout || 18000);
  }

  async function createAccount(payload) {
    try {
      const result = await callSmall('createAccount', payload, 18000);
      setSession(result.session);
      return result;
    } catch (error) {
      if (!/timed out|could not be reached|cannot reach/i.test(error.message || '')) throw error;
      try {
        const result = await callSmall('clientLogin', { email: payload.email, password: payload.password }, 15000);
        setSession(result.session);
        return result;
      } catch (_) {
        throw error;
      }
    }
  }

  async function clientLogin(email, password) {
    const result = await callSmall('clientLogin', { email, password }, 15000);
    setSession(result.session);
    return result;
  }

  async function adminLogin(email, password) {
    const result = await callSmall('adminLogin', { email, password }, 15000);
    setSession(result.session);
    return result;
  }

  async function health() {
    return callSmall('health', {}, 10000);
  }

  window.TFC_CRM = Object.freeze({
    get,
    post,
    health,
    createAccount,
    clientLogin,
    adminLogin,
    getSession,
    setSession,
    clearSession,
    logout: clearSession
  });
})();