(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const SESSION_KEY = 'tfc-v2-session';
  const BRIDGE_CHANNEL = 'tfc-crm-bridge';

  const makeId = () => (window.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

  function jsonp(action, payload = {}, timeout = 12000) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM service is not configured.'));
      const callback = `tfc_api_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('CRM request timed out.'));
      }, timeout);
      function cleanup() {
        clearTimeout(timer);
        delete window[callback];
        script.remove();
      }
      window[callback] = result => { cleanup(); resolve(result); };
      script.onerror = () => { cleanup(); reject(new Error('Could not reach the CRM service.')); };
      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function get(action, payload = {}, options = {}) {
    const session = getSession();
    const request = { ...payload };
    if (session?.token && !request.token) request.token = session.token;
    const result = await jsonp(action, request, options.timeout || 12000);
    if (!result?.ok) throw new Error(result?.error || 'CRM request failed.');
    return result;
  }

  function bridgePost(action, payload = {}, options = {}) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM service is not configured.'));

      const requestId = makeId();
      const session = getSession();
      const request = {
        action,
        requestId,
        ...(session?.token ? { token: session.token } : {}),
        ...payload
      };

      const iframe = document.createElement('iframe');
      iframe.name = `tfc_bridge_${requestId.replace(/[^a-zA-Z0-9]/g,'')}`;
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'display:none!important;width:0;height:0;border:0;';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = cfg.apiUrl;
      form.target = iframe.name;
      form.style.display = 'none';

      const bridge = document.createElement('input');
      bridge.type = 'hidden';
      bridge.name = 'bridge';
      bridge.value = '1';
      form.appendChild(bridge);

      const id = document.createElement('input');
      id.type = 'hidden';
      id.name = 'requestId';
      id.value = requestId;
      form.appendChild(id);

      const data = document.createElement('textarea');
      data.name = 'payload';
      data.value = JSON.stringify(request);
      form.appendChild(data);
      document.body.appendChild(form);

      const timeout = options.timeout || (action === 'uploadDocument' ? 60000 : 25000);
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The CRM did not respond. Please check the Apps Script deployment and try again.'));
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
        if (!result?.ok) return reject(new Error(result?.error || 'CRM operation failed.'));
        resolve(result);
      }

      window.addEventListener('message', onMessage);
      form.submit();
    });
  }

  async function post(action, payload = {}, options = {}) {
    return bridgePost(action, payload, options);
  }

  async function createAccount(payload) {
    const result = await bridgePost('createAccount', payload, { timeout: 25000 });
    setSession(result.session);
    return result;
  }

  async function clientLogin(email, password) {
    const result = await bridgePost('clientLogin', { email, password }, { timeout: 20000 });
    setSession(result.session);
    return result;
  }

  async function adminLogin(email, password) {
    const result = await bridgePost('adminLogin', { email, password }, { timeout: 20000 });
    setSession(result.session);
    return result;
  }

  window.TFC_CRM = Object.freeze({
    get,
    post,
    jsonp,
    createAccount,
    clientLogin,
    adminLogin,
    getSession,
    setSession,
    clearSession,
    logout: clearSession
  });
})();