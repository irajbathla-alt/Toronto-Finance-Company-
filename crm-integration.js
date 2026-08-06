(() => {
  const cfg = window.TFC_CONFIG || {};

  const jsonp = (action, payload = {}) => new Promise((resolve, reject) => {
    const callbackName = `tfc_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('The CRM confirmation timed out. Please try logging in with the account you created.'));
    }, 20000);

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
      reject(new Error('Could not confirm the CRM account. Please try again.'));
    };

    const request = { action, ...payload };
    script.src = `${cfg.apiUrl}?action=${encodeURIComponent(action)}&payload=${encodeURIComponent(JSON.stringify(request))}&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });

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
        const result = await jsonp('clientLogin', {
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