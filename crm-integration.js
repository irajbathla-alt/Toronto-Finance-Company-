(() => {
  const cfg = window.TFC_CONFIG || {};
  const api = async (action, payload = {}) => {
    if (cfg.demoMode || !cfg.apiUrl || cfg.apiUrl.includes('PASTE_')) {
      return { ok: true, data: { applicationId: 'TFC-DEMO', ...payload } };
    }
    const response = await fetch(cfg.apiUrl, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload })
    });
    return response.json();
  };

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
      ['requested','revenue','years'].forEach(id => {
        const el = document.getElementById(id);
        if (el) application[id] = el.value;
      });
      const purpose = document.getElementById('purpose');
      if (purpose) application.purpose = purpose.value;
      submit.disabled = true;
      submit.textContent = 'Creating Account...';
      try {
        const result = await api('createAccount', application);
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
