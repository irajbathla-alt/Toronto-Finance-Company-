(() => {
  const cfg = window.TFC_CONFIG || {};

  function jsonp(action, payload = {}, mode = 'payload') {
    return new Promise((resolve, reject) => {
      const callbackName = `tfc_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const params = new URLSearchParams({
        action,
        callback: callbackName,
        _: String(Date.now())
      });

      if (mode === 'payload') {
        params.set('payload', JSON.stringify({ action, ...payload }));
      } else {
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined && value !== null) params.set(key, String(value));
        });
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('CRM request timed out.'));
      }, 15000);

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
        reject(new Error('CRM script could not be loaded.'));
      };

      script.src = `${cfg.apiUrl}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function crmRequest(action, payload = {}) {
    const errors = [];

    for (const mode of ['payload', 'direct']) {
      try {
        return await jsonp(action, payload, mode);
      } catch (error) {
        errors.push(error.message);
      }
    }

    try {
      const params = new URLSearchParams({ action, _: String(Date.now()) });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });
      const response = await fetch(`${cfg.apiUrl}?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });
      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      errors.push(error.message);
    }

    throw new Error('Could not reach the CRM service. The Google Apps Script web app may need to be redeployed with access set to Anyone.');
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: form.toString()
    });
  }

  async function confirmAccount(application) {
    let lastError = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 1200));
      try {
        const result = await crmRequest('clientLogin', {
          email: application.email,
          password: application.password
        });
        if (result?.ok) return result;
        lastError = new Error(result?.error || 'Account is not available yet.');
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('The account could not be confirmed. Please try logging in.');
  }

  function enhance() {
    document.querySelectorAll('[data-go="dashboard"]').forEach(button => {
      if (button.dataset.crmLogin === 'true') return;
      button.dataset.crmLogin = 'true';
      button.textContent = 'Log In';
      button.onclick = event => {
        event.preventDefault();
        window.location.href = 'client-dashboard.html';
      };
    });

    const createButton = document.getElementById('createAccountBtn');
    if (!createButton || createButton.dataset.crmReady === 'true') return;
    createButton.dataset.crmReady = 'true';

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
      createButton.disabled = true;
      createButton.textContent = 'Creating Account...';
      if (message) message.textContent = 'Creating your secure client account and Drive folder.';

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
          localStorage.setItem('tfc-current-application', JSON.stringify(demo));
        } else {
          await createAccountPost(application);
          const result = await confirmAccount(application);
          localStorage.setItem('tfc-current-application', JSON.stringify(result.data));
        }

        createButton.textContent = 'Account Created';
        if (message) message.textContent = 'Success. Opening your client dashboard...';
        setTimeout(() => { window.location.href = 'client-dashboard.html'; }, 650);
      } catch (error) {
        if (message) message.textContent = error.message;
        createButton.disabled = false;
        createButton.textContent = 'Create Account';
      }
    };
  }

  enhance();
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
})();