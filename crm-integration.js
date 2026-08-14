(() => {
  const cfg = window.TFC_CONFIG || {};
  const SESSION_KEY = 'tfc-client-auth';
  const LEGACY_KEY = 'tfc-current-application';
  const REQUEST_TIMEOUT = Number(cfg.requestTimeout || 30000);

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

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function jsonp(action, payload = {}, mode = 'direct', timeout = REQUEST_TIMEOUT) {
    return new Promise((resolve, reject) => {
      if (!cfg.apiUrl) return reject(new Error('The CRM service has not been configured.'));
      const callbackName = `tfc_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({ action, callback: callbackName, _: String(Date.now()) });

      if (mode === 'payload') {
        params.set('payload', JSON.stringify({ action, ...payload }));
      } else {
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined && value !== null) params.set(key, String(value));
        });
      }

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

  async function fastRead(action, payload = {}, timeout = REQUEST_TIMEOUT) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await sleep(900);
      for (const mode of ['direct', 'payload']) {
        try {
          const result = await jsonp(action, payload, mode, timeout);
          if (result) return result;
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw lastError || new Error('CRM_UNREACHABLE');
  }

  async function recoverAccount(application, attempts = 4) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt) await sleep(1400 + attempt * 500);
      try {
        const recovery = await fastRead('clientLogin', {
          email: application.email,
          password: application.password
        }, 15000);
        if (recovery?.ok && recovery.data?.applicationId) return recovery;
      } catch (_) {
        // The original account-creation request may still be completing.
      }
    }
    return null;
  }

  async function createAccount(application) {
    let primaryError;

    try {
      const result = await jsonp('createAccount', application, 'direct', 45000);
      if (result?.ok) return result;
      if (result?.error && !/already exists/i.test(result.error)) {
        throw new Error(result.error);
      }
      if (/already exists/i.test(result?.error || '')) {
        const existing = await recoverAccount(application, 2);
        if (existing?.ok) return existing;
        throw new Error('An account already exists for this email. Please use Log In instead.');
      }
      throw new Error('Account creation could not be confirmed.');
    } catch (error) {
      primaryError = error;
    }

    // A Google Apps Script request can finish server-side after the browser timeout.
    // Check for the new account before attempting another creation request.
    const recovered = await recoverAccount(application, 3);
    if (recovered?.ok) return recovered;

    // One duplicate-safe retry. Code_SIMPLE.gs checks email uniqueness under a script lock.
    try {
      const retry = await jsonp('createAccount', application, 'payload', 35000);
      if (retry?.ok) return retry;
      if (/already exists/i.test(retry?.error || '')) {
        const existing = await recoverAccount(application, 3);
        if (existing?.ok) return existing;
        throw new Error('An account already exists for this email. Please use Log In instead.');
      }
      if (retry?.error) throw new Error(retry.error);
    } catch (retryError) {
      const finalRecovery = await recoverAccount(application, 3);
      if (finalRecovery?.ok) return finalRecovery;
      if (/already exists/i.test(retryError.message || '')) throw retryError;
    }

    if (/already exists/i.test(primaryError?.message || '')) throw primaryError;
    throw new Error('We could not confirm your account connection. Please click Create Account again. If the account was already created, use Log In with the same email and password.');
  }

  function enhance() {
    document.querySelectorAll('[data-go="dashboard"]').forEach(button => {
      if (button.dataset.crmLogin === 'true') return;
      button.dataset.crmLogin = 'true';
      button.textContent = 'Log In';
      button.onclick = event => {
        event.preventDefault();
        window.location.href = 'client-dashboard.html?login=1';
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
      const name = document.getElementById('name')?.value.trim() || '';
      const email = document.getElementById('email')?.value.trim().toLowerCase() || '';
      const password = document.getElementById('password')?.value || '';
      const message = document.getElementById('accountMessage');

      if (!name) {
        if (message) message.textContent = 'Please enter your full name.';
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        if (message) message.textContent = 'Please enter a valid email address.';
        return;
      }
      if (password.length < 8) {
        if (message) message.textContent = 'Your password must contain at least 8 characters.';
        return;
      }
      if (!cfg.apiUrl) {
        if (message) message.textContent = 'The CRM service has not been configured.';
        return;
      }

      const application = { name, email, password };
      clearClientSession();
      createButton.disabled = true;
      createButton.textContent = 'Creating Account...';
      if (message) message.textContent = 'Creating your secure account. Please keep this page open for a moment.';

      const progressTimer = setTimeout(() => {
        if (message) message.textContent = 'Still connecting securely. Your account may take a few extra seconds on the first connection.';
      }, 12000);

      try {
        let result;
        if (cfg.demoMode) {
          result = {
            ok: true,
            data: {
              applicationId: 'TFC-DEMO',
              name,
              email,
              status: 'Account Created',
              statements: 0,
              documents: []
            }
          };
        } else {
          result = await createAccount(application);
        }

        saveClientSession(result.data);
        createButton.textContent = 'Account Created';
        if (message) message.textContent = 'Success. Opening your client dashboard...';
        window.location.replace('client-dashboard.html');
      } catch (error) {
        clearClientSession();
        if (message) message.textContent = error.message || 'Account creation could not be confirmed. Please try again.';
        createButton.disabled = false;
        createButton.textContent = 'Create Account';
      } finally {
        clearTimeout(progressTimer);
      }
    };
  }

  enhance();
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
})();