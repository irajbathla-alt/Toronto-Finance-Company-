(() => {
  const cfg = window.TFC_CONFIG || {};
  const SESSION_KEY = 'tfc-client-auth';
  const LEGACY_KEY = 'tfc-current-application';

  function clearClientSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_KEY);
  }

  function saveClientSession(data) {
    const session = {
      applicationId: data.applicationId,
      email: data.email || '',
      authenticatedAt: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
  }

  function jsonp(action, payload = {}, mode = 'direct', timeout = 6500) {
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
    const requests = [
      jsonp(action, payload, 'direct'),
      jsonp(action, payload, 'payload')
    ];

    try {
      return await Promise.any(requests);
    } catch (_) {
      throw new Error('Could not reach the CRM service. Please try again.');
    }
  }

  async function createAccountPost(application) {
    const form = new URLSearchParams();
    form.set('action', 'createAccount');
    Object.entries(application).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.set(key, String(value));
    });

    await fetch(cfg.apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: form.toString()
    });
  }

  async function confirmAccount(application, startedAt) {
    let lastError = null;
    const delays = [250, 700, 1200];

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      try {
        const result = await fastRead('clientLogin', {
          email: application.email,
          password: application.password
        });

        if (result?.ok) {
          const createdAt = new Date(result.data?.created || 0).getTime();
          if (createdAt && createdAt < startedAt - 120000) {
            throw new Error('An account already exists for this email. Please use Log In instead.');
          }
          return result;
        }

        lastError = new Error(result?.error || 'Your account is still being prepared.');
      } catch (error) {
        lastError = error;
        if (/already exists/i.test(error.message)) throw error;
      }
    }

    throw lastError || new Error('Your account could not be confirmed. Please use Log In or try again.');
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
      if (message) message.textContent = 'Creating your secure account. This usually takes only a few seconds.';

      try {
        if (cfg.demoMode) {
          const demo = {
            applicationId: 'TFC-DEMO',
            name,
            email,
            status: 'Account Created',
            statements: 0,
            documents: []
          };
          saveClientSession(demo);
        } else {
          await createAccountPost(application);
          if (message) message.textContent = 'Account received. Confirming your secure login...';
          const result = await confirmAccount(application, startedAt);
          saveClientSession(result.data);
        }

        createButton.textContent = 'Account Created';
        if (message) message.textContent = 'Success. Opening your client dashboard...';
        window.location.replace('client-dashboard.html');
      } catch (error) {
        clearClientSession();
        if (message) message.textContent = error.message;
        createButton.disabled = false;
        createButton.textContent = 'Create Account';
      }
    };
  }

  enhance();
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
})();