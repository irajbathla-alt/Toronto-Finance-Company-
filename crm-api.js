(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const SESSION_KEY = 'tfc-v2-session';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const makeId = () => (window.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const normalize = value => String(value ?? '').trim();

  function getSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!value?.token || !value?.role) return null;
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

  function jsonp(action, payload = {}, timeout = 10000) {
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

      window[callback] = result => {
        cleanup();
        resolve(result);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error('Could not reach the CRM service.'));
      };
      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function get(action, payload = {}, options = {}) {
    const session = getSession();
    const request = { ...payload };
    if (session?.token && !request.token) request.token = session.token;
    const result = await jsonp(action, request, options.timeout || 10000);
    if (!result?.ok) throw new Error(result?.error || 'CRM request failed.');
    return result;
  }

  function adminUpdateMatches(data, payload) {
    const fields = ['status','advisor','messageTitle','messageBody','approvedAmount','quote','notes'];
    return fields.every(field => normalize(data?.[field]) === normalize(payload?.[field]));
  }

  async function recoverCompletedWrite(action, payload) {
    const session = getSession();
    if (!session?.token || !payload?.applicationId) return null;

    try {
      if (action === 'adminUpdate') {
        const result = await get('getClient', { applicationId: payload.applicationId }, { timeout: 9000 });
        if (!adminUpdateMatches(result.data, payload)) return null;
        return {
          ok: true,
          data: result.data,
          recovered: true,
          notificationQueued: ['Conditional Approval','Approved'].includes(String(result.data.status || '')) &&
            String(result.data.lastNotificationQueuedStatus || '') === String(result.data.status || '')
        };
      }

      if (action === 'adminEnsureDrive') {
        const result = await get('getClient', { applicationId: payload.applicationId }, { timeout: 9000 });
        return result.data?.driveUrl ? { ok:true, data:result.data, recovered:true } : null;
      }

      if (action === 'clientConfirmSignature') {
        const result = await get('getClient', { applicationId: payload.applicationId }, { timeout: 9000 });
        const confirmed = result.data?.signatureConfirmed === true || String(result.data?.signatureConfirmed).toLowerCase() === 'true';
        return confirmed ? { ok:true, data:result.data, recovered:true } : null;
      }
    } catch (_) {}

    return null;
  }

  async function post(action, payload = {}, options = {}) {
    if (!cfg.apiUrl) throw new Error('CRM service is not configured.');

    const requestId = makeId();
    const session = getSession();
    const body = JSON.stringify({
      action,
      requestId,
      ...(session?.token ? { token: session.token } : {}),
      ...payload
    });

    fetch(cfg.apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
      ...(body.length < 60000 ? { keepalive: true } : {})
    }).catch(() => null);

    const timeout = options.timeout || 18000;
    const started = Date.now();
    let delay = 220;

    while (Date.now() - started < timeout) {
      await sleep(delay);
      try {
        const remaining = Math.max(2500, timeout - (Date.now() - started));
        const result = await jsonp('operationResult', { requestId }, Math.min(7000, remaining));
        if (result?.pending) {
          delay = Math.min(1200, Math.round(delay * 1.35));
          continue;
        }
        if (!result?.ok) throw new Error(result?.error || 'CRM operation failed.');
        return result;
      } catch (error) {
        if (/operation failed|invalid|unauthorized|session expired|changed in another/i.test(error.message || '')) throw error;
        delay = Math.min(1200, Math.round(delay * 1.35));
      }
    }

    const recovered = await recoverCompletedWrite(action, payload);
    if (recovered) return recovered;

    throw new Error('The CRM could not confirm this operation. Refresh once before retrying to avoid a duplicate action.');
  }

  async function createAccount(payload) {
    const result = await post('createAccount', payload, { timeout: 18000 });
    setSession(result.session);
    return result;
  }

  async function clientLogin(email, password) {
    const result = await post('clientLogin', { email, password }, { timeout: 15000 });
    setSession(result.session);
    return result;
  }

  async function adminLogin(email, password) {
    const result = await post('adminLogin', { email, password }, { timeout: 15000 });
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