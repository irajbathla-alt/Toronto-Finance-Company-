(() => {
  const cfg = window.TFC_CONFIG || {};

  const jsonp = (action, payload = {}) => new Promise((resolve, reject) => {
    const cb = `tfc_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('The CRM confirmation timed out. Please try logging in with the account you just created.'));
    }, 20000);
    const cleanup = () => {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
    };
    window[cb] = data => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('Could not confirm the CRM account. Please try logging in with the same email and password.'));
    };
    script.src = `${cfg.apiUrl}?action=${encodeURIComponent(action)}&payload=${encodeURIComponent(JSON.stringify({ action, ...payload }))}&callback=${encodeURIComponent(cb)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });

  const createAccountPost = async application => {
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
  };

  const confirmAccount = async application => {
    let lastError = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 1200));
      try {
        const result = await jsonp('clientLogin', {
          email: application.email,
          password: application.password
        });
        if (result && result.ok) return result;
        lastError = new Error(result?.error || 'Account not available yet.');
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('The account was submitted but could not be confirmed. Please try logging in.');
  };

  const enhance = () => {
    document.querySelectorAll('[data-go="dashboard"]').forEach(button => {
      if (button.dataset.crmLogin === 'true') return;
      button.dataset.crmLogin = 'true';
      button.textContent = 'Log In';
      button.removeAttribute('data-go');
      button.onclick = () => { window.location.href = 'client-dashboard.html'; };
    });

    const submit = document.querySelector('#next');
    if (!submit || submit.textContent.trim().toLowerCase() !== 'submit application' || submit.dataset.crmReady === 'true') return;
    submit.dataset.crmReady = 'true';
    submit.onclick = async () => {
      const stored = JSON.parse(localStorage.getItem('tfc-demo') || '{}');
      const application = stored.application || {};
      ['requested', 'revenue', 'years'].forEach(id => {
        const el = document.getElementById(id);
        if (el) application[id] = el.value;
      });
      const purpose = document.getElementById('purpose');
      if (purpose) application.purpose = purpose.value;

      submit.disabled = true;
      submit.textContent = 'Creating Account...';

      try {
        await createAccountPost(application);
        const result = await confirmAccount(application);
        localStorage.setItem('tfc-current-application', JSON.stringify(result.data));
        document.body.insertAdjacentHTML('beforeend', `<div class="overlay" id="crmSuccess"><div class="modal" style="text-align:center"><h3>Application Submitted</h3><p>Your Toronto Finance Company account has been created successfully.</p><p><strong>Application ID: ${result.data.applicationId || 'Created'}</strong></p><button class="darkbtn wide" id="openPortal">Open Client Dashboard</button></div></div>`);
        document.getElementById('openPortal').onclick = () => window.location.href = 'client-dashboard.html';
      } catch (error) {
        alert(error.message);
        submit.disabled = false;
        submit.textContent = 'Submit Application';
      }
    };
  };

  enhance();
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
})();
