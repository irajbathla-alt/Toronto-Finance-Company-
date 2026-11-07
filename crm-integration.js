(() => {
  const cfg = window.TFC_CONFIG || {};
  const SESSION_KEY = 'tfc-client-auth';
  const LEGACY_KEY = 'tfc-current-application';
  const DEFAULT_TIMEOUT = Math.max(Number(cfg.requestTimeout || 30000), 30000);

  /*
   * One CRM, two intake shapes during rollout:
   * - current: name/email/phone/password
   * - extended: the current fields plus optional application details already
   *   accepted by Code_SIMPLE.gs createAccount().
   *
   * The default destination remains the production client dashboard.
   * Add ?portal=v4 to the public intake URL to exercise the V4 release
   * candidate end-to-end against the SAME Apps Script, Sheets, Drive and
   * session keys without changing the production route.
   */
  const INTAKE_FIELDS = Object.freeze({
    current: Object.freeze(['name','email','phone','password']),
    extended: Object.freeze([
      'name','email','phone','password',
      'business','address','city','province','postal',
      'industry','revenue','requested','years','purpose'
    ])
  });
  const PORTAL_TARGETS = Object.freeze({
    current: 'client-dashboard.html',
    v4: 'client-dashboard-v4.html'
  });

  function portalTarget() {
    const requested = new URLSearchParams(window.location.search).get('portal');
    return requested === 'v4' ? PORTAL_TARGETS.v4 : PORTAL_TARGETS.current;
  }

  function collectIntakeApplication() {
    const application = {};
    const fields = [...new Set([...INTAKE_FIELDS.current, ...INTAKE_FIELDS.extended])];

    fields.forEach(field => {
      const element = document.getElementById(field);
      if (!element) return;
      const value = field === 'password' ? element.value : String(element.value || '').trim();
      if (value !== '') application[field] = value;
    });

    application.name = String(application.name || '').trim();
    application.email = String(application.email || '').trim().toLowerCase();
    application.phone = String(application.phone || '').trim();
    application.password = String(application.password || '');
    return application;
  }

  function clearClientSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_KEY);
  }

  function saveClientSession(data) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      applicationId: data.applicationId,
      email: data.email || '',
      authenticatedAt: new Date().toISOString()
    }));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
  }

  function queueSignupNotification(data) {
    if (cfg.demoMode || !cfg.apiUrl || !data?.applicationId || !data?.email) return;

    const body = JSON.stringify({
      action: 'sendSignupNotification',
      applicationId: data.applicationId,
      email: data.email
    });

    try {
      fetch(cfg.apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body
      }).catch(() => {});
    } catch (_) {}
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function jsonp(action, payload = {}, timeout = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('CRM_NOT_CONFIGURED'));

      const callbackName = `tfc_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback: callbackName, _: String(Date.now()) });

      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('CRM_TIMEOUT'));
      }, timeout);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = data => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('CRM_UNREACHABLE'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function verifyCreatedAccount(application) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await sleep(1800);
      try {
        const result = await jsonp('clientLogin', {
          email: application.email,
          password: application.password
        }, 30000);
        if (result?.ok && result.data?.applicationId) return result;
      } catch (_) {}
    }
    return null;
  }

  async function createAccount(application) {
    try {
      const result = await jsonp('createAccount', application, 90000);

      if (result?.ok && result.data?.applicationId) return result;

      if (/already exists/i.test(result?.error || '')) {
        const existing = await verifyCreatedAccount(application);
        if (existing?.ok) return existing;
        throw new Error('An account already exists for this email. Please use Log In instead.');
      }

      if (result?.error) throw new Error(result.error);
      throw new Error('Account creation could not be confirmed.');
    } catch (error) {
      if (!['CRM_TIMEOUT', 'CRM_UNREACHABLE'].includes(error.message || '')) throw error;

      const recovered = await verifyCreatedAccount(application);
      if (recovered?.ok) return recovered;

      throw new Error('We could not connect to the secure application service. Please try Create Account again in a moment. If you already created the account, use Log In with the same email and password.');
    }
  }

  function enhance() {
    document.querySelectorAll('[data-go="dashboard"]').forEach(button => {
      if (button.dataset.crmLogin === 'true') return;
      button.dataset.crmLogin = 'true';
      button.textContent = 'Log In';
      button.onclick = event => {
        event.preventDefault();
        window.location.href = portalTarget() + '?login=1';
      };
    });

    const createButton = document.getElementById('createAccountBtn');
    if (!createButton || createButton.dataset.crmReady === 'true') return;
    createButton.dataset.crmReady = 'true';

    const passwordInput = document.getElementById('password');
    if (passwordInput && passwordInput.dataset.enterReady !== 'true') {
      passwordInput.dataset.enterReady = 'true';
      passwordInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') createButton.click();
      });
    }

    createButton.onclick = async () => {
      const application = collectIntakeApplication();
      const { name, email, phone, password } = application;
      const message = document.getElementById('accountMessage');

      if (!name) {
        if (message) message.textContent = 'Please enter your full name.';
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        if (message) message.textContent = 'Please enter a valid email address.';
        return;
      }
      if (phone.replace(/\D/g, '').length < 7) {
        if (message) message.textContent = 'Please enter a valid phone number.';
        return;
      }
      if (password.length < 8) {
        if (message) message.textContent = 'Your password must contain at least 8 characters.';
        return;
      }
      if (!cfg.apiUrl) {
        if (message) message.textContent = 'The secure application service is temporarily unavailable.';
        return;
      }

      clearClientSession();
      createButton.disabled = true;
      createButton.textContent = 'Creating Account...';
      if (message) message.textContent = 'Creating your secure account. Please keep this page open.';

      const progress1 = setTimeout(() => {
        if (message) message.textContent = 'Still connecting securely. Please keep this page open while we finish creating your account.';
      }, 12000);
      const progress2 = setTimeout(() => {
        if (message) message.textContent = 'Google is taking a little longer than usual. We are still confirming your account securely.';
      }, 40000);

      try {
        const result = cfg.demoMode
          ? {
              ok: true,
              data: {
                applicationId: 'TFC-DEMO',
                name,
                email,
                phone,
                status: 'Account Created',
                statements: 0,
                documents: []
              }
            }
          : await createAccount(application);

        saveClientSession(result.data);
        queueSignupNotification(result.data);
        createButton.textContent = 'Account Created';
        if (message) message.textContent = 'Success. Opening your client dashboard...';
        window.location.replace(portalTarget());
      } catch (error) {
        clearClientSession();
        if (message) message.textContent = error.message || 'Account creation could not be confirmed. Please try again.';
        createButton.disabled = false;
        createButton.textContent = 'Create Account';
      } finally {
        clearTimeout(progress1);
        clearTimeout(progress2);
      }
    };
  }

  /*
   * Shared adapter for the eventual intake consolidation. A second secure
   * intake can reuse this exact createAccount/session contract instead of
   * introducing another CRM deployment.
   */
  window.TFC_CRM_INTAKE = Object.freeze({
    fields: INTAKE_FIELDS,
    portalTarget,
    collectApplication: collectIntakeApplication,
    createAccount,
    saveClientSession,
    queueSignupNotification
  });

  enhance();
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
})();