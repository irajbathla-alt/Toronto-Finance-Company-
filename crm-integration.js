(() => {
  const cfg = window.TFC_CONFIG || {};
  const jsonp = (action, payload = {}) => new Promise((resolve, reject) => {
    const cb = `tfc_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('The CRM request timed out.')); }, 20000);
    const cleanup = () => { clearTimeout(timer); delete window[cb]; script.remove(); };
    window[cb] = data => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('Could not reach the CRM service.')); };
    script.src = `${cfg.apiUrl}?action=${encodeURIComponent(action)}&payload=${encodeURIComponent(JSON.stringify({ action, ...payload }))}&callback=${encodeURIComponent(cb)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });

  const enhance = () => {
    document.querySelectorAll('[data-go="dashboard"]').forEach(button => {
      if (button.dataset.crmLogin === 'true') return;
      button.dataset.crmLogin = 'true';
      button.textContent = 'Log In';
      button.removeAttribute('data-go');
      button.onclick = () => { window.location.href = 'client-portal.html'; };
    });

    const submit = document.querySelector('#next');
    if (!submit || submit.textContent.trim().toLowerCase() !== 'submit application' || submit.dataset.crmReady === 'true') return;
    submit.dataset.crmReady = 'true';
    submit.onclick = async () => {
      const stored = JSON.parse(localStorage.getItem('tfc-demo') || '{}');
      const application = stored.application || {};
      ['requested','revenue','years'].forEach(id => { const el = document.getElementById(id); if (el) application[id] = el.value; });
      const purpose = document.getElementById('purpose'); if (purpose) application.purpose = purpose.value;
      submit.disabled = true; submit.textContent = 'Creating Account...';
      try {
        const result = await jsonp('createAccount', application);
        if (!result.ok) throw new Error(result.error || 'Account could not be created');
        localStorage.setItem('tfc-current-application', JSON.stringify(result.data));
        document.body.insertAdjacentHTML('beforeend', `<div class="overlay" id="crmSuccess"><div class="modal" style="text-align:center"><h3>Application Submitted</h3><p>Your Toronto Finance Company account has been created successfully.</p><p><strong>Application ID: ${result.data.applicationId || 'Created'}</strong></p><button class="darkbtn wide" id="openPortal">Open Client Portal</button></div></div>`);
        document.getElementById('openPortal').onclick = () => window.location.href = 'client-portal.html';
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
