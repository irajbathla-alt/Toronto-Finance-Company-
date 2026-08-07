(() => {
  'use strict';

  const cfg = window.TFC_CONFIG || {};
  const SESSION_KEY = 'tfc-v2-session';
  const BRIDGE_CHANNEL = 'tfc-crm-bridge';
  let backendPromise = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const makeId = () => (window.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const normalize = value => String(value ?? '').trim();

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

  function jsonpAt(url, action, payload = {}, timeout = 12000) {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error('CRM service is not configured.'));
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
      script.src = `${url}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function isBridgeBackend(health) {
    return /direct post bridge/i.test(String(health?.transport || '')) || /crm v3/i.test(String(health?.service || ''));
  }

  async function detectBackend(force = false) {
    if (backendPromise && !force) return backendPromise;
    backendPromise = (async () => {
      const urls = [...new Set([cfg.apiUrl, cfg.apiFallbackUrl].filter(Boolean))];
      let lastError = null;
      for (const url of urls) {
        try {
          const health = await jsonpAt(url, 'health', {}, 8000);
          if (health?.ok) return { url, health, bridge: isBridgeBackend(health) };
          lastError = new Error(health?.sheetError || health?.driveError || health?.error || 'CRM health check failed.');
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('No CRM deployment is available.');
    })();
    try {
      return await backendPromise;
    } catch (error) {
      backendPromise = null;
      throw error;
    }
  }

  async function jsonp(action, payload = {}, timeout = 12000) {
    const backend = await detectBackend();
    return jsonpAt(backend.url, action, payload, timeout);
  }

  async function get(action, payload = {}, options = {}) {
    const session = getSession();
    const request = { ...payload };
    if (session?.token && !request.token) request.token = session.token;
    const result = await jsonp(action, request, options.timeout || 12000);
    if (!result?.ok) throw new Error(result?.error || 'CRM request failed.');
    return result;
  }

  function bridgePostAt(url, action, request, options = {}) {
    return new Promise((resolve, reject) => {
      const requestId = request.requestId || makeId();
      request.requestId = requestId;

      const iframe = document.createElement('iframe');
      iframe.name = `tfc_bridge_${requestId.replace(/[^a-zA-Z0-9]/g,'')}`;
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'display:none!important;width:0;height:0;border:0;';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url;
      form.target = iframe.name;
      form.style.display = 'none';

      const bridge = document.createElement('input');
      bridge.type = 'hidden'; bridge.name = 'bridge'; bridge.value = '1';
      form.appendChild(bridge);

      const id = document.createElement('input');
      id.type = 'hidden'; id.name = 'requestId'; id.value = requestId;
      form.appendChild(id);

      const data = document.createElement('textarea');
      data.name = 'payload'; data.value = JSON.stringify(request);
      form.appendChild(data);
      document.body.appendChild(form);

      const timeout = options.timeout || (action === 'uploadDocument' ? 65000 : 25000);
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('CRM bridge timed out.'));
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

  async function legacyPostAt(url, action, request, options = {}) {
    const requestId = request.requestId || makeId();
    request.requestId = requestId;
    const body = JSON.stringify(request);

    fetch(url, {
      method:'POST', mode:'no-cors', cache:'no-store', redirect:'follow',
      headers:{'Content-Type':'text/plain;charset=UTF-8'}, body,
      ...(body.length < 60000 ? { keepalive:true } : {})
    }).catch(() => null);

    const timeout = options.timeout || (action === 'uploadDocument' ? 65000 : 20000);
    const started = Date.now();
    let delay = 300;
    while (Date.now() - started < timeout) {
      await sleep(delay);
      try {
        const result = await jsonpAt(url, 'operationResult', { requestId }, Math.min(7000, timeout));
        if (result?.pending) {
          delay = Math.min(1400, Math.round(delay * 1.35));
          continue;
        }
        if (!result?.ok) throw new Error(result?.error || 'CRM operation failed.');
        return result;
      } catch (error) {
        if (/invalid|unauthorized|expired|changed in another|operation failed/i.test(error.message || '')) throw error;
        delay = Math.min(1400, Math.round(delay * 1.35));
      }
    }
    throw new Error('CRM write confirmation timed out.');
  }

  function adminUpdateMatches(data, payload) {
    const fields = ['status','advisor','messageTitle','messageBody','approvedAmount','quote','notes'];
    return fields.every(field => normalize(data?.[field]) === normalize(payload?.[field]));
  }

  async function recoverWrite(action, payload) {
    try {
      if (action === 'adminUpdate') {
        const result = await get('getClient',{applicationId:payload.applicationId},{timeout:9000});
        return adminUpdateMatches(result.data,payload) ? {ok:true,data:result.data,recovered:true} : null;
      }
      if (action === 'adminEnsureDrive') {
        const result = await get('getClient',{applicationId:payload.applicationId},{timeout:9000});
        return result.data?.driveUrl ? {ok:true,data:result.data,recovered:true} : null;
      }
      if (action === 'clientConfirmSignature') {
        const result = await get('getClient',{applicationId:payload.applicationId},{timeout:9000});
        const yes = result.data?.signatureConfirmed === true || String(result.data?.signatureConfirmed).toLowerCase()==='true';
        return yes ? {ok:true,data:result.data,recovered:true} : null;
      }
    } catch (_) {}
    return null;
  }

  async function directJsonpWrite(backend, action, request, timeout) {
    const result = await jsonpAt(backend.url, action, request, timeout || 15000);
    if (!result?.ok) throw new Error(result?.error || 'CRM operation failed.');
    return result;
  }

  async function post(action, payload = {}, options = {}) {
    const backend = await detectBackend();
    const session = getSession();
    const request = {
      action,
      requestId: makeId(),
      ...(session?.token ? {token:session.token} : {}),
      ...payload
    };

    try {
      if (backend.bridge) return await bridgePostAt(backend.url, action, request, options);
      return await legacyPostAt(backend.url, action, request, options);
    } catch (error) {
      const recovered = await recoverWrite(action, payload);
      if (recovered) return recovered;

      // Compatibility fallback for an older Apps Script deployment. Keep this
      // only for small requests; documents remain POST-only because URLs cannot
      // safely carry large PDF payloads.
      if (action !== 'uploadDocument') {
        try { return await directJsonpWrite(backend, action, request, options.timeout || 15000); }
        catch (fallbackError) { throw fallbackError; }
      }
      throw error;
    }
  }

  async function createAccount(payload) {
    try {
      const result = await post('createAccount', payload, {timeout:25000});
      setSession(result.session);
      return result;
    } catch (error) {
      // If account creation succeeded but its response was lost, login recovers
      // the exact new account without creating a duplicate.
      try {
        const result = await directJsonpWrite(await detectBackend(), 'clientLogin', {email:payload.email,password:payload.password}, 12000);
        setSession(result.session);
        return result;
      } catch (_) {
        throw error;
      }
    }
  }

  async function clientLogin(email, password) {
    const result = await post('clientLogin',{email,password},{timeout:20000});
    setSession(result.session);
    return result;
  }

  async function adminLogin(email, password) {
    const result = await post('adminLogin',{email,password},{timeout:20000});
    setSession(result.session);
    return result;
  }

  async function health(force=false){ return (await detectBackend(force)).health; }

  window.TFC_CRM = Object.freeze({
    get, post, jsonp, health,
    createAccount, clientLogin, adminLogin,
    getSession, setSession, clearSession,
    logout:clearSession
  });
})();