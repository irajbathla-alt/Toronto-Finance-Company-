(() => {
  const cfg = window.TFC_CONFIG || {};
  const SESSION_KEY = 'tfc-client-auth';
  const LEGACY_KEY = 'tfc-current-application';

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

  function jsonp(action, payload = {}, mode = 'direct', timeout = 8000) {
    return new Promise((resolve, reject) => {
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
        reject(new Error('The CRM is taking longer than expected.'));
      }, timeout);

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = data => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('The CRM service could not be reached.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function fastRead(action, payload = {}) {
    try {
      return await Promise.any([
        jsonp(action, payload, 'direct'),
        jsonp(action, payload, 'payload')
      ]);
    } catch (_) {
      throw new Error('Could not reach the CRM service. Please try again.');
    }
  }

  async function createAccount(application, startedAt) {
    try {
      const result = await jsonp('createAccount', application, 'direct', 12000);
      if (!result?.ok) throw new Error(result?.error || 'Account creation failed.');
      return result;
    } catch (primaryError) {
      if (/already exists/i.test(primaryError.message || '')) throw primaryError;

      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const recovery = await fastRead('clientLogin', {
          email: application.email,
          password: application.password
        });
        if (recovery?.ok) {
          const createdAt = new Date(recovery.data?.created || 0).getTime();
          if (!createdAt || createdAt >= startedAt - 120000) return recovery;
          throw new Error('An account already exists for this email. Please use Log In instead.');
        }
      } catch (recoveryError) {
        if (/already exists/i.test(recoveryError.message || '')) throw recoveryError;
      }

      throw primaryError;
    }
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
      if (!cfg.apiUrl || cfg.apiUrl.includes('PASTE_')) {
        if (message) message.textContent = 'The CRM service has not been configured.';
        return;
      }

      const application = { name, email, password };
      const startedAt = Date.now();
      clearClientSession();
      createButton.disabled = true;
      createButton.textContent = 'Creating Account...';
      if (message) message.textContent = 'Creating your secure account...';

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
          result = await createAccount(application, startedAt);
        }

        saveClientSession(result.data);
        createButton.textContent = 'Account Created';
        if (message) message.textContent = 'Success. Opening your client dashboard...';
        window.location.replace('client-dashboard.html');
      } catch (error) {
        clearClientSession();
        if (message) message.textContent = error.message || 'Account creation failed. Please try again.';
        createButton.disabled = false;
        createButton.textContent = 'Create Account';
      }
    };
  }

  enhance();
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
})();
